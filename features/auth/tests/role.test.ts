import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ConflictError } from '../../../shared/errors'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { accountListResponseSchema, sessionResponseSchema } from '../contract'
import { changeRole, createUser, disableAccount, enableAccount, listAccounts } from '../index'

/**
 * Role enforcement.
 *
 * Drives the real Hono app in process, the same way the other suites do, and
 * parses every body with the feature's own schemas. The database is emptied once
 * per file, so tests here may create users freely, but they must not assume the
 * table is empty at the start of an individual test.
 *
 * The two status codes asserted below are read from `shared/errors`: an absent
 * session is `UnauthorizedError` at 401, a wrong role is `ForbiddenError` at
 * 403, and a refused lifecycle change is `ConflictError` at 409.
 */
const PASSWORD = 'correct horse battery staple'

async function makeUser(role: 'admin' | 'editor'): Promise<string> {
  const email = `role-${randomUUID()}@example.com`
  await createUser({ email, password: PASSWORD, role })
  return email
}

async function loginCookie(email: string): Promise<string> {
  const response = await api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })

  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

async function listUsersRequest(cookie?: string): Promise<Response> {
  return api.request('/api/auth/users', {
    headers: cookie ? { cookie } : {},
  })
}

describe('GET /api/auth/users', () => {
  it('refuses a request with no session', async () => {
    /*
     * Prevents a route being added without a guard. This is the mistake that
     * matters, so it is asserted before anything else about the route.
     */
    const response = await listUsersRequest()

    expect(response.status).toBe(401)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('refuses a signed-in editor', async () => {
    /*
     * Prevents enforcement being written but not wired: a route that only
     * checks for a session would answer 200 here and leak every account.
     */
    const email = await makeUser('editor')
    const cookie = await loginCookie(email)

    const response = await listUsersRequest(cookie)

    expect(response.status).toBe(403)
  })

  it('refuses an editor with the FORBIDDEN envelope, not a bare failure', async () => {
    /*
     * Prevents a handler building its own refusal. If it did, the code would
     * not be the one `shared/http/app.ts` maps, and a client branching on the
     * code would break.
     */
    const email = await makeUser('editor')
    const cookie = await loginCookie(email)

    const response = await listUsersRequest(cookie)
    const body = failureEnvelopeSchema.parse(await response.json())

    expect(response.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN')
  })

  it('answers an administrator with a body the contract accepts', async () => {
    /*
     * Prevents the response drifting from `accountListResponseSchema`, and
     * guards the shape the next change builds its screens on.
     */
    const email = await makeUser('admin')
    const cookie = await loginCookie(email)

    const response = await listUsersRequest(cookie)

    expect(response.status).toBe(200)

    const body = accountListResponseSchema.parse(await response.json())
    expect(body.data.accounts.length).toBeGreaterThan(0)
    expect(body.data.accounts.some(account => account.email === email)).toBe(true)
  })
})

describe('sign in as an editor', () => {
  it('still works, and /api/auth/me reports the editor role', async () => {
    /*
     * The regression guard for "we did not accidentally lock editors out". Role
     * enforcement is meant to restrict routes, never to stop somebody signing in
     * or from being told who they are.
     */
    const email = await makeUser('editor')
    const cookie = await loginCookie(email)

    expect(cookie).not.toBe('')

    const response = await api.request('/api/auth/me', { headers: { cookie } })

    expect(response.status).toBe(200)

    const body = sessionResponseSchema.parse(await response.json())
    expect(body.data.user.role).toBe('editor')
  })
})

describe('the last active administrator', () => {
  /**
   * Gives this block a known starting point: at least one active administrator
   * and at least one active editor, whoever else is in the table.
   *
   * WHY, MEASURED RATHER THAN ASSUMED. Vitest shuffles test order on request, and
   * without a floor these tests depended on what the rest of the file happened to
   * leave behind. One seed ran the promotion test first, which left a lone
   * administrator and no editor, and the guard then correctly refused to disable
   * what it found. The guard was right and the test was wrong, which is the right
   * way round for that to happen, but a test whose result depends on its
   * neighbours is not evidence.
   */
  async function ensureCover(): Promise<void> {
    const active = listAccounts().filter(account => account.disabledAt === null)

    if (!active.some(account => account.role === 'admin')) await makeUser('admin')
    if (!active.some(account => account.role === 'editor')) await makeUser('editor')
  }

  /**
   * Reduces the database to exactly one active administrator, with an active
   * editor left holding the cover the guards must ignore, and puts the other
   * administrators back afterwards.
   *
   * Every authorisation hook is async, so this is async throughout. A synchronous
   * body would receive the promise rather than the accounts it asks for.
   */
  async function withOneActiveAdmin<T>(body: () => Promise<T> | T): Promise<T> {
    await ensureCover()

    const probeEmail = `role-probe-${randomUUID()}@example.com`
    await createUser({ email: probeEmail, password: PASSWORD, role: 'editor' })

    const others = listAccounts()
      .filter(account => account.disabledAt === null && account.role === 'admin')
      .slice(1)

    for (const account of others) disableAccount(account.email)

    try {
      return await body()
    }
    finally {
      for (const account of others) enableAccount(account.email)
      disableAccount(probeEmail)
    }
  }

  it('cannot be disabled while an active editor remains', async () => {
    /*
     * Prevents the deployment that cannot be administered. An editor does not
     * count as cover, so a check on active accounts alone would let this through
     * and leave nobody who can reach the admin surface. The helper holds an active
     * editor open for the duration, which is the cover the guard must ignore.
     */
    await withOneActiveAdmin(() => {
      const survivor = listAccounts()
        .filter(account => account.disabledAt === null && account.role === 'admin')[0]

      expect(survivor).toBeDefined()
      expect(() => disableAccount(survivor?.email ?? ''))
        .toThrow(/that is the only active administrator\. disabling/i)
    })
  })

  it('is refused with a conflict, which maps to 409', async () => {
    /*
     * Prevents the guard being a different class of error. A validation error
     * here would tell an operator the input was wrong, when the input was fine
     * and the state is what refused it.
     *
     * The class check is the real assertion: `ConflictError.status` is a constant,
     * so reading it proves very little on its own.
     */
    await withOneActiveAdmin(() => {
      const survivor = listAccounts()
        .filter(account => account.disabledAt === null && account.role === 'admin')[0]

      expect(survivor).toBeDefined()

      let thrown: unknown
      try {
        disableAccount(survivor?.email ?? '')
      }
      catch (error: unknown) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(ConflictError)
      expect((thrown as ConflictError).status).toBe(409)
    })
  })

  it('cannot be demoted by the CLI service path', async () => {
    /*
     * Prevents the CLI offering a route to the same stranded state that
     * disabling is refused for. The CLI is not driven in process here, so this
     * calls the same service function the CLI calls.
     */
    await withOneActiveAdmin(() => {
      const survivor = listAccounts()
        .filter(account => account.disabledAt === null && account.role === 'admin')[0]

      expect(survivor).toBeDefined()
      expect(() => changeRole(survivor?.email ?? '', 'editor'))
        .toThrow(/that is the only active administrator\. demoting/i)
    })
  })
})

describe('role changes', () => {
  it('promotes an editor, and the promotion takes effect on the next request', async () => {
    /*
     * Proves the `role` action actually writes the change, and that the role is
     * read from the row rather than cached in the session: the same cookie that
     * got a 403 has to get a 200 afterwards.
     *
     * A second administrator is made first. Promotion is intentionally unguarded,
     * so this test passes either way, but starting an administrator keeps it
     * honest and keeps the database from being reduced to a single administrator,
     * which the guards below deliberately refuse to touch.
     */
    await makeUser('admin')

    const email = await makeUser('editor')
    const cookie = await loginCookie(email)

    expect((await listUsersRequest(cookie)).status).toBe(403)

    const account = changeRole(email, 'admin')
    expect(account.role).toBe('admin')

    expect((await listUsersRequest(cookie)).status).toBe(200)
  })

  it('refuses a role the account already has', async () => {
    /*
     * Prevents a no-op being reported as a change, which would make the CLI's
     * output a lie.
     */
    const email = await makeUser('editor')

    expect(() => changeRole(email, 'editor')).toThrow(/already has the role/i)
  })

  it('refuses an account that does not exist', () => {
    expect(() => changeRole('nobody@example.com', 'editor')).toThrow(/no account exists/i)
  })
})
