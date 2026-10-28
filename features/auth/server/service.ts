import { randomUUID } from 'node:crypto'
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/errors'
import {
  type Account,
  MIN_PASSWORD_LENGTH,
  SESSION_TTL_DAYS,
  type PublicUser,
  type Role,
} from '../contract'
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password'
import {
  countActiveAdmins,
  countActiveUsers,
  countUsers,
  deleteExpiredSessions,
  deleteSessionById,
  deleteUserSessions,
  findSessionById,
  findUserByEmail,
  findUserById,
  insertSession,
  insertUser,
  listUsers,
  setUserDisabledAt,
  setUserRole,
  updateUserPassword,
  type UserRow,
} from './repository'
import { hashSessionToken, mintSessionToken } from './tokens'
import { withPasswordWork } from './throttle'

/**
 * Auth business rules.
 *
 * The repository stores rows and this decides what they mean. Nothing here
 * touches HTTP, so the rules can be tested without a request, and nothing here
 * writes SQL, so they can change without touching the schema.
 */

const MS_PER_DAY = 86_400_000

/**
 * Deliberately identical for an unknown email and a wrong password.
 *
 * Two different messages would tell an attacker which emails are registered,
 * which is the first step of a targeted attack. `verifyAgainstDummy` exists for
 * the same reason on the timing side.
 */
const CREDENTIALS_ERROR = 'Email or password is incorrect.'

export function toPublicUser(row: UserRow): PublicUser {
  // Built field by field rather than spread, so `password_hash` cannot leak
  // into a response because someone added a column to the table.
  return { id: row.id, email: row.email, role: row.role }
}

export type SignInResult = {
  user: PublicUser
  token: string
  expiresAt: Date
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const row = findUserByEmail(email)

  if (!row) {
    await withPasswordWork(() => verifyAgainstDummy(password))
    throw new UnauthorizedError(CREDENTIALS_ERROR)
  }

  // The load shed wraps both verification paths, so an unknown email and a known
  // one behave identically under saturation too. Anything else would be a fresh
  // way to tell the two apart.
  const matches = await withPasswordWork(() => verifyPassword(password, row.password_hash))
  if (!matches) throw new UnauthorizedError(CREDENTIALS_ERROR)

  /*
   * Checked after the password, never before.
   *
   * Checking first would make "this account exists and is disabled" answerable
   * without knowing the password, and it would answer faster, which is a timing
   * signal on top of a message. Verified second, the cost is identical to a wrong
   * password.
   *
   * The message is specific rather than folded into the credentials error,
   * because the person hitting this is almost always a former staff member who
   * deserves to know why they cannot get in.
   */
  if (row.disabled_at !== null) {
    throw new UnauthorizedError('This account has been disabled. Ask whoever runs the site to re-enable it.')
  }

  // Login is a good moment to sweep: rare enough to be cheap, frequent enough
  // to keep up with expiry.
  deleteExpiredSessions(new Date().toISOString())

  const token = mintSessionToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * MS_PER_DAY)

  insertSession({
    id: hashSessionToken(token),
    user_id: row.id,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  })

  return { user: toPublicUser(row), token, expiresAt }
}

/**
 * Whether a stored expiry has passed.
 *
 * Fails closed on purpose. The obvious version of this check is
 * `session.expires_at <= new Date().toISOString()`, and that is a string
 * comparison, not a date comparison: any stored value that happens to sort above
 * the current timestamp, such as `zzzz`, would be treated as a future expiry and
 * authenticate. An unparseable value must never mean "still valid".
 */
export function sessionHasExpired(expiresAt: string, now: number = Date.now()): boolean {
  const parsed = Date.parse(expiresAt)
  if (!Number.isFinite(parsed)) return true

  return parsed <= now
}

export type SessionDetail = {
  user: PublicUser
  /** The hash stored in `sessions.id`, not the cookie value. */
  sessionId: string
}

/**
 * Turns a cookie value into a signed-in user and the session behind it.
 *
 * The session id is returned because changing a password has to end every other
 * session and spare this one, and that needs to know which one this is.
 *
 * Every lookup checks expiry here rather than trusting a background sweep, so an
 * expired row can never authenticate anyone even if the sweep never runs.
 */
export function resolveSessionDetail(token: string | undefined): SessionDetail | null {
  if (!token) return null

  const session = findSessionById(hashSessionToken(token))
  if (!session) return null

  if (sessionHasExpired(session.expires_at)) {
    deleteSessionById(session.id)
    return null
  }

  const user = findUserById(session.user_id)
  if (!user) return null

  /*
   * A disabled account may not act, even if a session row somehow survived.
   *
   * Revocation deletes the rows, so this is the second line of defence: it also
   * covers a session restored from a backup, or one inserted by hand while
   * debugging. Deleting it on sight means the next request starts from nothing.
   */
  if (user.disabled_at !== null) {
    deleteSessionById(session.id)
    return null
  }

  return { user: toPublicUser(user), sessionId: session.id }
}

/** Turns a cookie value into a signed-in user, or null. Never throws. */
export function resolveSession(token: string | undefined): PublicUser | null {
  return resolveSessionDetail(token)?.user ?? null
}

export function signOut(token: string | undefined): void {
  if (!token) return
  deleteSessionById(hashSessionToken(token))
}

export async function createUser(input: {
  email: string
  password: string
  role?: Role
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase()

  /*
   * Enforced here as well as in the API, because the CLI is how the first
   * account on a deployment gets made, and `--password=x` should not be a way
   * around a rule the web form has to follow.
   */
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }

  if (findUserByEmail(email)) {
    throw new ConflictError(`A user with the email ${email} already exists.`)
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()

  insertUser({
    id,
    email,
    passwordHash: await hashPassword(input.password),
    role: input.role ?? 'admin',
    createdAt,
  })

  const row = findUserById(id)
  if (!row) throw new Error('User insert did not persist. This should be impossible.')
  return toPublicUser(row)
}

export type ChangePasswordResult = {
  otherSessionsRevoked: number
}

/**
 * Changes the signed-in user's own password.
 *
 * Takes the cookie value rather than a session id, so token hashing stays inside
 * this feature. The route never handles a hash it would have to keep consistent
 * with `tokens.ts`.
 */
export async function changePassword(input: {
  token: string | undefined
  currentPassword: string
  newPassword: string
}): Promise<ChangePasswordResult> {
  const session = resolveSessionDetail(input.token)
  if (!session) throw new UnauthorizedError()

  const row = findUserById(session.user.id)
  if (!row) throw new UnauthorizedError()

  const matches = await withPasswordWork(() =>
    verifyPassword(input.currentPassword, row.password_hash),
  )

  /*
   * Specific here, unlike at sign in. The caller already holds a session, so
   * saying which of the two fields is wrong reveals nothing they could not
   * discover by trying once more.
   */
  if (!matches) throw new UnauthorizedError('Your current password is not correct.')

  updateUserPassword(row.id, await hashPassword(input.newPassword))

  /*
   * Everything except this tab.
   *
   * Changing a password is often a response to a suspected leak, and a session
   * that outlives the change defeats the reason for making it. The current
   * session is spared so the person is not thrown out mid-task.
   */
  const otherSessionsRevoked = deleteUserSessions(row.id, session.sessionId)

  return { otherSessionsRevoked }
}

/**
 * Derived from the contract, not written twice.
 *
 * `accountSchema` is what the route validates on the way out, so this type and
 * the response cannot drift apart: a field removed from the schema stops being
 * something the service can return.
 */
/**
 * Replaces an account's password, for the case where nobody knows it.
 *
 * WHY THIS EXISTS AT ALL, GIVEN THAT CHANGING A PASSWORD IS A WEB SCREEN. The
 * screen requires the current password, which is correct and is exactly useless
 * when the password is the thing that was lost. Without this, the only way back
 * into a deployment whose administrator has forgotten theirs is to create another
 * administrator and abandon the first account, and there is no delete-user
 * command, so the old one stays forever.
 *
 * WHY IT TAKES A PASSWORD RATHER THAN MINTING ONE. The caller decides, because
 * the randomness belongs where it can be printed and forgotten, and a service
 * that returns a password is a service that could one day log one. The CLI
 * generates it and prints it once, the same way `user:create` does.
 *
 * WHY EVERY SESSION ENDS. A reset that leaves a session alive does not reset
 * anything: whoever was already signed in as that account keeps working, and the
 * reset was probably performed because somebody noticed exactly that. This
 * differs from `changePassword`, which spares the asking tab, because here the
 * person asking is not the account holder and there is no tab to spare.
 *
 * Returns how many sessions were ended, because a number above zero is the
 * interesting part: it means somebody was signed in as that account just now.
 */
export async function resetPassword(input: {
  email: string
  password: string
}): Promise<{ account: AccountRow, sessionsEnded: number }> {
  const email = input.email.trim().toLowerCase()

  /*
   * The same floor the web form and `createUser` enforce. A reset is a way to set
   * a password, so it is a way to set a weak one unless it is refused here too.
   */
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }

  const row = findUserByEmail(email)
  if (!row) throw new NotFoundError(`No account exists for ${email}.`)

  updateUserPassword(row.id, await hashPassword(input.password))
  const sessionsEnded = deleteUserSessions(row.id)

  return { account: toAccountRow(row), sessionsEnded }
}

export type AccountRow = Account

function toAccountRow(row: UserRow): AccountRow {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    disabledAt: row.disabled_at,
  }
}

export function listAccounts(): AccountRow[] {
  return listUsers().map(toAccountRow)
}

/**
 * Ends an account's access.
 *
 * Both halves happen together and neither is optional. The timestamp without the
 * session deletion leaves a signed-in browser working until the session expires,
 * up to thirty days later. The deletion without the timestamp lets the person
 * sign straight back in with the password they already know.
 *
 * There is no web screen for this, on purpose. Revocation is an action taken by
 * whoever runs the deployment, who already has a shell, and putting it behind a
 * session would mean deciding who may revoke whom. Roles are enforced now, so
 * that question has an answer, `admin`. What is missing is a screen, not a rule,
 * and an account administration screen is a different job from this one.
 */
export function disableAccount(email: string): AccountRow {
  const row = findUserByEmail(email.trim().toLowerCase())
  if (!row) throw new NotFoundError(`No account exists for ${email}.`)
  if (row.disabled_at !== null) throw new ConflictError(`${row.email} is already disabled.`)

  /*
   * Refused rather than warned about, and the refusal is recoverable: re-enabling
   * uses the same CLI and needs no session. Locking yourself out of a client's
   * deployment is a bad enough afternoon to justify one guard.
   */
  if (countActiveUsers() <= 1) {
    throw new ConflictError('That is the only active account. Disabling it would lock everybody out.')
  }

  /*
   * The same guard one level down, and it fires even when editors remain.
   *
   * An editor cannot administer anything, so a deployment whose last active
   * administrator is disabled has no staff who can reach the admin surface at
   * all, whatever else is still signed in. Only an active administrator counts
   * as one who can be spared.
   */
  if (row.role === 'admin' && countActiveAdmins() <= 1) {
    throw new ConflictError(
      'That is the only active administrator. Disabling it would leave nobody who can administer the site. Make another account an administrator first: npm run user:role -- --email=<address> --role=admin',
    )
  }

  const disabledAt = new Date().toISOString()
  setUserDisabledAt(row.id, disabledAt)
  deleteUserSessions(row.id)

  return { ...toAccountRow(row), disabledAt }
}

export function enableAccount(email: string): AccountRow {
  const row = findUserByEmail(email.trim().toLowerCase())
  if (!row) throw new NotFoundError(`No account exists for ${email}.`)
  if (row.disabled_at === null) throw new ConflictError(`${row.email} is already active.`)

  setUserDisabledAt(row.id, null)

  return { ...toAccountRow(row), disabledAt: null }
}

/**
 * Moves an account between the two roles.
 *
 * Demotion is refused rather than warned about, for the same reason disabling
 * is: a deployment with no administrator cannot be administered through the web,
 * and every path back in needs the shell. Promotion cannot create that state, so
 * it is not guarded.
 *
 * No session is touched. The role is read from the row on every request, so the
 * next request a demoted user makes is already treated as an editor.
 */
export function changeRole(email: string, role: Role): AccountRow {
  const row = findUserByEmail(email.trim().toLowerCase())
  if (!row) throw new NotFoundError(`No account exists for ${email}.`)
  if (row.disabled_at !== null) {
    throw new ConflictError(`${row.email} is disabled. Enable it before changing its role.`)
  }
  if (row.role === role) throw new ConflictError(`${row.email} already has the role ${role}.`)

  /*
   * Demoting the last active administrator is refused even if active editors
   * exist, because an editor cannot administer anything. Spelled out here rather
   * than shared with `disableAccount`: the two guards count the same thing, but
   * they answer different questions about it.
   */
  if (row.role === 'admin' && countActiveAdmins() <= 1) {
    throw new ConflictError(
      'That is the only active administrator. Demoting it would leave nobody who can administer the site. Make another account an administrator first: npm run user:role -- --email=<address> --role=admin',
    )
  }

  setUserRole(row.id, role)

  return { ...toAccountRow(row), role }
}

export function userCount(): number {
  return countUsers()
}
