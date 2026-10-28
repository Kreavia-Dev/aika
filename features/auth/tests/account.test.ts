import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { api } from '../../../shared/http/app'
import { changePasswordResponseSchema } from '../contract'
import { createUser, disableAccount, enableAccount, listAccounts } from '../index'

/**
 * Account lifecycle: changing your own password, and revoking somebody else's
 * access.
 *
 * Drives the real Hono app in process, the same way the other suites do. The
 * database is emptied once per file, so tests here may create users freely, but
 * they must not assume the table is empty at the start of an individual test.
 */
const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'a completely different passphrase'
const SHORT_PASSWORD = 'too short'

async function makeUser(): Promise<string> {
  const email = `account-${randomUUID()}@example.com`
  await createUser({ email, password: PASSWORD })
  return email
}

async function login(email: string, password: string): Promise<Response> {
  return api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

async function loginCookie(email: string, password: string = PASSWORD): Promise<string> {
  const response = await login(email, password)
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

async function changePassword(body: unknown, cookie?: string): Promise<Response> {
  return api.request('/api/auth/password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function me(cookie: string): Promise<Response> {
  return api.request('/api/auth/me', { headers: { cookie } })
}

describe('POST /api/auth/password', () => {
  it('refuses a request with no session', async () => {
    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    })

    expect(response.status).toBe(401)
  })

  it('refuses the wrong current password', async () => {
    const email = await makeUser()
    const cookie = await loginCookie(email)

    const response = await changePassword({
      currentPassword: 'not the password',
      newPassword: NEW_PASSWORD,
    }, cookie)

    expect(response.status).toBe(401)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.message).toMatch(/current password is not correct/i)

    // And the old password still works, because nothing happened.
    expect((await login(email, PASSWORD)).status).toBe(200)
  })

  it('refuses a new password that is too short', async () => {
    const email = await makeUser()
    const cookie = await loginCookie(email)

    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: SHORT_PASSWORD,
    }, cookie)

    expect(response.status).toBe(422)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('VALIDATION_ERROR')
    // The message has to name the rule, because the browser does not know the
    // minimum and cannot warn before the request.
    expect(body.message).toMatch(/at least 12 characters/i)
  })

  it('changes the password, and the old one stops working', async () => {
    const email = await makeUser()
    const cookie = await loginCookie(email)

    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    }, cookie)

    expect(response.status).toBe(200)
    expect(changePasswordResponseSchema.safeParse(await response.json()).success).toBe(true)

    expect((await login(email, PASSWORD)).status).toBe(401)
    expect((await login(email, NEW_PASSWORD)).status).toBe(200)
  })

  it('keeps the session that made the change', async () => {
    const email = await makeUser()
    const cookie = await loginCookie(email)

    await changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, cookie)

    expect((await me(cookie)).status).toBe(200)
  })

  it('ends every other session, and says how many', async () => {
    const email = await makeUser()

    const first = await loginCookie(email)
    const second = await loginCookie(email)
    const third = await loginCookie(email)

    expect((await me(second)).status).toBe(200)

    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    }, first)

    const body = changePasswordResponseSchema.parse(await response.json())

    // Two others existed, so two should have been ended.
    expect(body.data.otherSessionsRevoked).toBe(2)

    // This is the point of the whole feature: a stolen session dies when the
    // password changes, rather than living on until it expires.
    expect((await me(second)).status).toBe(401)
    expect((await me(third)).status).toBe(401)
    expect((await me(first)).status).toBe(200)
  })

  it('reports zero when there was nothing else to end', async () => {
    const email = await makeUser()
    const cookie = await loginCookie(email)

    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    }, cookie)

    const body = changePasswordResponseSchema.parse(await response.json())
    expect(body.data.otherSessionsRevoked).toBe(0)
  })

  it('rejects a body that is not JSON', async () => {
    const email = await makeUser()
    const cookie = await loginCookie(email)

    const response = await api.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'not json',
    })

    expect(response.status).toBe(422)
  })
})

describe('account revocation', () => {
  it('refuses to create a user with a short password', async () => {
    await expect(
      createUser({ email: `short-${randomUUID()}@example.com`, password: SHORT_PASSWORD }),
    ).rejects.toThrow(/at least 12 characters/i)
  })

  it('stops a disabled account from signing in', async () => {
    const email = await makeUser()
    await makeUser()

    expect((await login(email, PASSWORD)).status).toBe(200)

    disableAccount(email)

    const response = await login(email, PASSWORD)
    expect(response.status).toBe(401)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.message).toMatch(/disabled/i)
  })

  it('ends a disabled account\'s existing sessions immediately', async () => {
    const email = await makeUser()
    await makeUser()

    const cookie = await loginCookie(email)
    expect((await me(cookie)).status).toBe(200)

    disableAccount(email)

    // Not "on the next sign in". The browser already holding a session has to
    // stop working, or revoking access would take up to thirty days to mean
    // anything.
    expect((await me(cookie)).status).toBe(401)
  })

  it('lets a re-enabled account sign in again', async () => {
    const email = await makeUser()
    await makeUser()

    disableAccount(email)
    expect((await login(email, PASSWORD)).status).toBe(401)

    enableAccount(email)
    expect((await login(email, PASSWORD)).status).toBe(200)
  })

  it('refuses an account that does not exist', () => {
    expect(() => disableAccount('nobody@example.com')).toThrow(/no account exists/i)
    expect(() => enableAccount('nobody@example.com')).toThrow(/no account exists/i)
  })

  it('refuses to disable an account twice', async () => {
    const email = await makeUser()
    await makeUser()

    disableAccount(email)

    expect(() => disableAccount(email)).toThrow(/already disabled/i)
  })

  it('refuses to enable an account that is already active', async () => {
    const email = await makeUser()

    expect(() => enableAccount(email)).toThrow(/already active/i)
  })

  it('refuses to disable the only active account', async () => {
    /*
     * Reduces the database to exactly one active account, whatever earlier tests
     * left behind, and puts the others back afterwards so this test does not
     * depend on where it sits in the file. Locking everybody out of a client's
     * deployment is bad enough to be worth a guard, and the guard is only worth
     * having if it is tested.
     *
     * TWO GUARDS NOW SHARE THIS TERRAIN. Since roles are enforced, a second guard
     * refuses to disable the last active administrator. That message contains the
     * words "only active", so a loose match here would pass on either guard.
     * The assertion below pins the account guard's own wording, and the explicit
     * editor keeps the administrator guard from firing first, so this test cannot
     * quietly stop testing the guard it names.
     */
    await createUser({
      email: `sole-account-editor-${randomUUID()}@example.com`,
      password: 'a password long enough to satisfy the rule',
      role: 'editor',
    })

    const active = listAccounts().filter(account => account.disabledAt === null)
    // Captured, not re-read inside the body: disabling an entry invalidates the
    // list this was filtered from.
    const others = active.slice(1)
    const survivor = active[0]

    for (const account of others) disableAccount(account.email)

    try {
      expect(active.length).toBeGreaterThan(0)
      expect(survivor).toBeDefined()
      expect(() => disableAccount(survivor?.email ?? ''))
        .toThrow(/that is the only active account\./i)
    }
    finally {
      for (const account of others) enableAccount(account.email)
    }
  })
})
