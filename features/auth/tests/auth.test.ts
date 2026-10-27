import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { logoutResponseSchema, sessionResponseSchema } from '../contract'
import { createUser } from '../index'

/**
 * Exercises the real Hono app in process, the same way the health feature does.
 *
 * Tests share one database file, so every test creates its own user under a
 * distinct email rather than assuming an empty table.
 */
const PASSWORD = 'correct horse battery staple'
const WRONG_PASSWORD = 'correct horse battery stapler'

async function makeUser(email: string): Promise<void> {
  await createUser({ email, password: PASSWORD })
}

async function loginRequest(email: string, password: string): Promise<Response> {
  return api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

function cookieValueFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? ''
  return header.split(';')[0] ?? ''
}

async function meRequest(cookie?: string): Promise<Response> {
  return api.request('/api/auth/me', {
    headers: cookie ? { cookie } : {},
  })
}

describe('POST /api/auth/login', () => {
  it('signs in with the correct credentials', async () => {
    await makeUser('login-ok@example.com')

    const response = await loginRequest('login-ok@example.com', PASSWORD)

    expect(response.status).toBe(200)

    const parsed = sessionResponseSchema.safeParse(await response.json())
    expect(parsed.success).toBe(true)
  })

  it('sets a session cookie that JavaScript cannot read', async () => {
    await makeUser('cookie@example.com')

    const response = await loginRequest('cookie@example.com', PASSWORD)
    const header = response.headers.get('set-cookie') ?? ''

    expect(header).toContain('aika_session=')
    expect(header.toLowerCase()).toContain('httponly')
    expect(header.toLowerCase()).toContain('samesite=lax')
  })

  it('never returns the password hash', async () => {
    await makeUser('nohash@example.com')

    const response = await loginRequest('nohash@example.com', PASSWORD)
    const raw = await response.text()

    // The strongest form of this assertion: the hash format cannot appear
    // anywhere in the body, whatever the shape of the response.
    expect(raw).not.toContain('scrypt$')
    expect(raw).not.toContain(PASSWORD)
  })

  it('matches the email regardless of casing', async () => {
    await makeUser('casing@example.com')

    const response = await loginRequest('CASING@Example.COM', PASSWORD)

    expect(response.status).toBe(200)
  })

  it('refuses the wrong password', async () => {
    await makeUser('wrongpw@example.com')

    const response = await loginRequest('wrongpw@example.com', WRONG_PASSWORD)

    expect(response.status).toBe(401)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('answers identically for an unknown email and a bad password', async () => {
    await makeUser('enumeration@example.com')

    const unknownEmail = await loginRequest('nobody@example.com', PASSWORD)
    const badPassword = await loginRequest('enumeration@example.com', WRONG_PASSWORD)

    // Different answers here would tell an attacker which emails are registered.
    expect(unknownEmail.status).toBe(badPassword.status)

    const unknownBody = failureEnvelopeSchema.parse(await unknownEmail.json())
    const badBody = failureEnvelopeSchema.parse(await badPassword.json())

    expect(unknownBody.message).toBe(badBody.message)
  })

  it('rejects a malformed body with the validation envelope', async () => {
    const response = await api.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x' }),
    })

    expect(response.status).toBe(422)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.errors?.length).toBeGreaterThan(0)
  })

  it('rejects a body that is not JSON at all', async () => {
    const response = await api.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })

    expect(response.status).toBe(422)
  })
})

describe('GET /api/auth/me', () => {
  it('refuses an anonymous request', async () => {
    const response = await meRequest()

    expect(response.status).toBe(401)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('refuses a cookie that was never issued', async () => {
    const response = await meRequest('aika_session=made-up-token')

    expect(response.status).toBe(401)
  })

  it('returns the signed-in user for a real session', async () => {
    await makeUser('me@example.com')

    const login = await loginRequest('me@example.com', PASSWORD)
    const cookie = cookieValueFrom(login)

    const response = await meRequest(cookie)

    expect(response.status).toBe(200)

    const parsed = sessionResponseSchema.parse(await response.json())
    expect(parsed.data.user.email).toBe('me@example.com')
    expect(parsed.data.user.role).toBe('admin')
  })
})

describe('POST /api/auth/logout', () => {
  it('invalidates the session, not just the cookie', async () => {
    await makeUser('logout@example.com')

    const login = await loginRequest('logout@example.com', PASSWORD)
    const cookie = cookieValueFrom(login)

    const beforeLogout = await meRequest(cookie)
    expect(beforeLogout.status).toBe(200)

    const logout = await api.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    })

    expect(logout.status).toBe(200)
    expect(logoutResponseSchema.safeParse(await logout.json()).success).toBe(true)

    // Replaying the same cookie must fail, because the row is gone. A logout
    // that only clears the cookie leaves the token valid for anyone who kept a
    // copy of it.
    const afterLogout = await meRequest(cookie)
    expect(afterLogout.status).toBe(401)
  })

  it('succeeds even without a session', async () => {
    const response = await api.request('/api/auth/logout', { method: 'POST' })

    expect(response.status).toBe(200)
  })
})

describe('sign in under a burst', () => {
  it('sheds load instead of queueing everything, and never crashes', async () => {
    await makeUser('burst@example.com')

    /**
     * Sign in is the only endpoint that does deliberate slow work, about 70 ms
     * of CPU per attempt, in a single threaded process. A burst like this is the
     * only realistic way an unauthenticated caller can stall the whole site.
     *
     * The count is high on purpose: each request must still be in flight when
     * the next arrives for the ceiling to be reached.
     */
    const responses = await Promise.all(
      Array.from({ length: 24 }, () => loginRequest('burst@example.com', PASSWORD)),
    )

    const statuses = responses.map(response => response.status)

    // The property that must always hold: a burst produces answers, never a 500.
    expect(statuses).not.toContain(500)

    // The load shed engages rather than queueing unbounded work.
    expect(statuses.filter(status => status === 503).length).toBeGreaterThan(0)
  })

  it('answers normally again after the burst', async () => {
    const response = await loginRequest('burst@example.com', PASSWORD)

    expect(response.status).toBe(200)
  })
})
