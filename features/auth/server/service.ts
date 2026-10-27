import { randomUUID } from 'node:crypto'
import { ConflictError, UnauthorizedError } from '../../../shared/errors'
import { SESSION_TTL_DAYS, type PublicUser, type Role } from '../contract'
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password'
import {
  countUsers,
  deleteExpiredSessions,
  deleteSessionById,
  findSessionById,
  findUserByEmail,
  findUserById,
  insertSession,
  insertUser,
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

/**
 * Turns a cookie value into a signed-in user, or null.
 *
 * Every lookup checks expiry here rather than trusting a background sweep, so
 * an expired row can never authenticate anyone even if the sweep never runs.
 */
export function resolveSession(token: string | undefined): PublicUser | null {
  if (!token) return null

  const session = findSessionById(hashSessionToken(token))
  if (!session) return null

  if (sessionHasExpired(session.expires_at)) {
    deleteSessionById(session.id)
    return null
  }

  const user = findUserById(session.user_id)
  return user ? toPublicUser(user) : null
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

export function userCount(): number {
  return countUsers()
}
