import { describe, expect, it } from 'vitest'
import { getDb } from '../../../shared/database/client'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { contactResponseSchema } from '../contract'

/**
 * Drives the real Hono app in process, the same way the other features do.
 */
const VALID = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'I would like to talk about a booking system for our studio.',
}

async function post(payload: unknown): Promise<Response> {
  return api.request('/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
}

/**
 * The feature has no read endpoint yet, on purpose: this rung adds the endpoint
 * that stores a submission, and the next one adds the inbox. So persistence is
 * asserted against the table directly, and the comment says why.
 *
 * The counts are taken as differences rather than absolutes, because tests
 * within a file share one database.
 */
function storedCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS total FROM contact_messages').get() as { total: number }
  return row.total
}

function newestMessage(): { name: string, email: string, message: string, user_agent: string | null } | undefined {
  return getDb()
    .prepare(`
      SELECT name, email, message, user_agent FROM contact_messages
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `)
    .get() as { name: string, email: string, message: string, user_agent: string | null } | undefined
}

describe('POST /api/contact', () => {
  it('accepts a valid submission', async () => {
    const response = await post(VALID)

    expect(response.status).toBe(200)

    const parsed = contactResponseSchema.safeParse(await response.json())
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.data.received).toBe(true)
  })

  it('stores it', async () => {
    const before = storedCount()

    await post(VALID)

    expect(storedCount()).toBe(before + 1)
  })

  it('trims the input and lowercases the email', async () => {
    await post({
      name: '  Grace Hopper  ',
      email: '  GRACE@Example.COM  ',
      message: '   A message long enough to pass the minimum length rule.   ',
    })

    const row = newestMessage()

    expect(row?.name).toBe('Grace Hopper')
    expect(row?.email).toBe('grace@example.com')
    expect(row?.message.startsWith('A message')).toBe(true)
  })

  it('truncates an absurd user agent rather than storing it whole', async () => {
    const huge = 'A'.repeat(5000)

    await api.request('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': huge },
      body: JSON.stringify(VALID),
    })

    expect(newestMessage()?.user_agent?.length).toBe(300)
  })

  it('drops a submission that filled the honeypot, but says it succeeded', async () => {
    const before = storedCount()

    const response = await post({ ...VALID, website: 'https://spam.example.com' })

    // Saying it failed would tell the bot it was caught and teach it to retune.
    expect(response.status).toBe(200)
    expect(storedCount()).toBe(before)
  })

  it('stores a submission that left the honeypot empty', async () => {
    const before = storedCount()

    await post({ ...VALID, website: '' })

    expect(storedCount()).toBe(before + 1)
  })
})

describe('POST /api/contact validation', () => {
  it('rejects a message that is too short', async () => {
    const response = await post({ ...VALID, message: 'hi' })

    expect(response.status).toBe(422)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.errors?.some(issue => issue.startsWith('message'))).toBe(true)
  })

  it('rejects a malformed email', async () => {
    const response = await post({ ...VALID, email: 'not an email' })

    expect(response.status).toBe(422)
    expect((await response.json() as { code: string }).code).toBe('VALIDATION_ERROR')
  })

  it('rejects an empty name', async () => {
    const response = await post({ ...VALID, name: '   ' })

    expect(response.status).toBe(422)
  })

  it('rejects a missing field', async () => {
    const response = await post({ email: 'ada@example.com', message: 'A long enough message here.' })

    expect(response.status).toBe(422)
  })

  it('rejects a message beyond the maximum length', async () => {
    const response = await post({ ...VALID, message: 'x'.repeat(5001) })

    expect(response.status).toBe(422)
  })

  it('rejects an oversized honeypot rather than accepting it as spam', async () => {
    const response = await post({ ...VALID, website: 'x'.repeat(201) })

    expect(response.status).toBe(422)
  })

  it('rejects a body that is not JSON at all', async () => {
    const response = await post('not json')

    expect(response.status).toBe(422)
  })

  it('rejects an array body', async () => {
    const response = await post([VALID])

    expect(response.status).toBe(422)
  })

  it('stores nothing when validation fails', async () => {
    const before = storedCount()

    await post({ ...VALID, email: 'nope' })

    expect(storedCount()).toBe(before)
  })
})
