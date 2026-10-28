import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { createUser, disableAccount, generatePassword, resetPassword } from '../index'
/**
 * Resetting a password from the shell, for the case where nobody knows it.
 *
 * Drives the real Hono app for the sign in half, because the point of a reset is
 * that the new password works and the old one does not, and only a real request
 * proves that. The database is emptied once per file, so these tests create their
 * own accounts and do not assume an empty table.
 */
const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'a completely different passphrase'

async function makeUser(role: 'admin' | 'editor' = 'admin'): Promise<string> {
  const email = `reset-${randomUUID()}@example.com`
  await createUser({ email, password: PASSWORD, role })
  return email
}

async function login(email: string, password: string): Promise<Response> {
  return api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

describe('resetPassword', () => {
  it('makes the new password work and the old one stop working', async () => {
    /*
     * The whole point, stated as two requests. A reset that only changed the hash
     * and not the observable behaviour would pass a weaker test that inspected
     * the table, and fail for the person who needs it.
     */
    const email = await makeUser()

    await resetPassword({ email, password: NEW_PASSWORD })

    expect((await login(email, NEW_PASSWORD)).status).toBe(200)
    expect((await login(email, PASSWORD)).status).toBe(401)
  })

  it('ends every session the account held, and says how many', async () => {
    /*
     * A reset that leaves a signed-in browser working has not reset anything, and
     * the usual reason to run this is that such a browser was noticed. Zero is
     * the ordinary answer; the interesting case is the one below.
     */
    const email = await makeUser()

    const first = await login(email, PASSWORD)
    const second = await login(email, PASSWORD)
    const firstCookie = (first.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const secondCookie = (second.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

    expect((await api.request('/api/auth/me', { headers: { cookie: firstCookie } })).status).toBe(200)

    const { sessionsEnded } = await resetPassword({ email, password: NEW_PASSWORD })

    expect(sessionsEnded).toBe(2)

    // The sessions are gone from the database, not merely from the caller's hands.
    expect((await api.request('/api/auth/me', { headers: { cookie: firstCookie } })).status).toBe(401)
    expect((await api.request('/api/auth/me', { headers: { cookie: secondCookie } })).status).toBe(401)
  })

  it('reports zero when nothing was signed in', async () => {
    // Worth asserting, because the CLI prints this number and a wrong one is a
    // small lie an operator would act on.
    const email = await makeUser()

    const { sessionsEnded } = await resetPassword({ email, password: NEW_PASSWORD })

    expect(sessionsEnded).toBe(0)
  })

  it('refuses a password under the minimum length', async () => {
    /*
     * A reset is a way to set a password, so it is a way to set a weak one unless
     * it is refused here. The web form and `createUser` both enforce this, and a
     * shell command is exactly where somebody would look for a way around it.
     */
    const email = await makeUser()

    await expect(resetPassword({ email, password: 'too short' }))
      .rejects.toThrow(/at least 12 characters/i)
  })

  it('refuses an account that does not exist', async () => {
    // The operator has usually mistyped an address at this point, so the message
    // has to be the reason rather than a crash.
    await expect(resetPassword({ email: 'nobody@example.com', password: NEW_PASSWORD }))
      .rejects.toThrow(/no account exists/i)
  })

  it('does not refuse a disabled account, and leaves it disabled', async () => {
    /*
     * Deliberate. Resetting the password of a disabled account is a reasonable
     * thing to do while preparing to re-enable it, and refusing would force the
     * operator into a pointless order of commands. The account stays disabled, so
     * the new password still does not open the door, and the CLI says so.
     */
    const email = await makeUser()
    await createUser({ email: `keeper-${randomUUID()}@example.com`, password: PASSWORD })
    disableAccount(email)

    const { account } = await resetPassword({ email, password: NEW_PASSWORD })

    expect(account.disabledAt).not.toBeNull()
    expect((await login(email, NEW_PASSWORD)).status).toBe(401)
  })
})

describe('generatePassword', () => {
  it('clears the minimum length the rest of the application enforces', () => {
    // A generator that produced something the service then refuses would be a
    // contradiction discovered only by running the command.
    expect(generatePassword().length).toBeGreaterThanOrEqual(12)
  })

  it('does not repeat', () => {
    /*
     * Not a randomness test, which is not possible in a unit test. It catches the
     * mistake that actually happens: a generator accidentally seeded with a
     * constant, or returning a literal during a refactor.
     */
    const passwords = new Set(Array.from({ length: 50 }, () => generatePassword()))

    expect(passwords.size).toBe(50)
  })

  it('survives a shell and a JSON string without escaping', () => {
    /*
     * Base64url, so no `$` for a shell to expand, no quote to close a string, and
     * no `+` or `/` that a URL would rewrite. The operator pastes this into a
     * terminal, and the person who receives it pastes it into a form.
     */
    for (let index = 0; index < 20; index++) {
      expect(generatePassword()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })
})
