import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { getDb } from '../../../shared/database/client'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { createUser } from '../../auth'
import { contactMessagesResponseSchema, contactResponseSchema } from '../contract'
import { insertContactMessage } from '../server/repository'

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
 * The stored rows are asserted directly against the table, because this feature
 * has no read endpoint for anything except the staff inbox.
 *
 * Counts are taken as differences rather than absolutes, because tests within a
 * file share one database.
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

/**
 * The rows created since the table held `count` rows, newest first.
 *
 * `newestMessage` answers "what is the latest row", which is the wrong question
 * for a test that just wrote a row: two submissions inside the same millisecond
 * make `created_at` ambiguous, and the tie breaks on an arbitrary rowid. Asking
 * for everything above a captured rowid cannot race.
 */
/**
 * The row at the given rank from newest, counting backwards from the current top.
 *
 * `messageAfter(n)` returns the first row added after the table held `n` rows.
 * Both callers record a count, post exactly one message, and ask; the arithmetic
 * below assumes exactly that. Passing a count that does not match reality returns
 * an older row rather than `undefined`, which is why this is spelled out instead
 * of looking like a general "rows since" helper.
 *
 * `newestMessage` is the wrong question here: two submissions inside the same
 * millisecond make `created_at` ambiguous, and the tie breaks on an arbitrary
 * rowid. Counting from `rowid` cannot race.
 */
function messageAfter(
  countBefore: number,
): { name: string, email: string, message: string, user_agent: string | null } | undefined {
  const added = storedCount() - countBefore

  if (added !== 1) {
    throw new Error(
      `messageAfter expects exactly one row to have been added, but ${added} were. Fix the test.`,
    )
  }

  return getDb()
    .prepare(`
      SELECT name, email, message, user_agent FROM contact_messages
      ORDER BY rowid DESC
      LIMIT 1
    `)
    .get() as { name: string, email: string, message: string, user_agent: string | null } | undefined
}

const INBOX_PASSWORD = 'a password long enough to be hashed without complaint'

/** Creates a user under a unique address and returns a session cookie. */
async function signIn(): Promise<string> {
  const email = `inbox-${randomUUID()}@example.com`
  await createUser({ email, password: INBOX_PASSWORD })

  const response = await api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: INBOX_PASSWORD }),
  })

  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

async function inbox(cookie?: string): Promise<Response> {
  return api.request('/api/contact/messages', {
    headers: cookie ? { cookie } : {},
  })
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
    const before = storedCount()

    await post({
      name: '  Grace Hopper  ',
      email: '  GRACE@Example.COM  ',
      message: '   A message long enough to pass the minimum length rule.   ',
    })

    /*
     * Read by rowid, not by "the newest message".
     *
     * MEASURED. Two submissions in a test run can share a `created_at` to the
     * millisecond, and the first version of this assertion asked for the newest
     * row by timestamp. Shuffled test order then read another test's row and
     * failed with "expected 'Sender 104' to be 'Grace Hopper'". The row this
     * test just created is the highest rowid, which is a fact rather than a
     * race.
     */
    const row = messageAfter(before)

    expect(row?.name).toBe('Grace Hopper')
    expect(row?.email).toBe('grace@example.com')
    expect(row?.message.startsWith('A message')).toBe(true)
  })

  it('truncates an absurd user agent rather than storing it whole', async () => {
    const huge = 'A'.repeat(5000)
    const before = storedCount()

    await api.request('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': huge },
      body: JSON.stringify(VALID),
    })

    // By rowid for the same reason as above: a timestamp cannot break a tie.
    expect(messageAfter(before)?.user_agent?.length).toBe(300)
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

describe('GET /api/contact/messages', () => {
  it('refuses the inbox without a session', async () => {
    // This route is the only thing between a visitor and every message a client
    // has ever received, so the refusal is asserted rather than assumed.
    const response = await inbox()

    expect(response.status).toBe(401)
  })

  it('shows what came through the form, to somebody who is signed in', async () => {
    const cookie = await signIn()

    /*
     * Dated in 2031, one year above the newest fixture any other test inserts.
     *
     * MEASURED, AND THIS IS NOT A RACE. The inbox returns the newest hundred
     * messages, and the cap test deliberately inserts a hundred and five rows in
     * 2030. A shuffled order can run that first, and then an ordinary submission
     * made now is genuinely older than all of them and genuinely outside the
     * list. The page is right and the test was wrong. Dated above those fixtures,
     * this row is the newest whatever ran before it.
     *
     * A unique name as well, so the assertion cannot be satisfied by a row some
     * earlier test happened to leave behind.
     */
    const probeName = `Inbox Probe ${randomUUID()}`
    const createdAt = new Date(Date.UTC(2031, 0, 1)).toISOString()

    insertContactMessage({
      id: probeName,
      name: probeName,
      email: 'inbox-probe@example.com',
      message: 'Inserted directly, so this row has no honeypot to satisfy, and dated above every other fixture.',
      userAgent: null,
      createdAt,
    })

    const response = await inbox(cookie)
    expect(response.status).toBe(200)

    const body = contactMessagesResponseSchema.parse(await response.json())
    expect(body.data.messages.some(message => message.name === probeName)).toBe(true)
  })

  it('never shows a message that filled the honeypot', async () => {
    const cookie = await signIn()

    await post({
      ...VALID,
      name: 'Spam Probe',
      message: 'Buy cheap followers now, visit our site for the very best deals.',
      website: 'https://spam.example.com',
    })

    const response = await inbox(cookie)
    const body = contactMessagesResponseSchema.parse(await response.json())

    expect(body.data.messages.some(message => message.name === 'Spam Probe')).toBe(false)
  })

  it('lists newest first', async () => {
    const cookie = await signIn()

    const response = await inbox(cookie)
    const body = contactMessagesResponseSchema.parse(await response.json())

    const timestamps = body.data.messages.map(message => Date.parse(message.createdAt))
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps)
  })

  it('caps the list so the response cannot grow without bound', async () => {
    const cookie = await signIn()

    /*
     * Dated in the far future so these rows are unambiguously the newest, which
     * makes the assertion independent of whatever earlier tests left behind.
     */
    for (let index = 0; index < 105; index++) {
      insertContactMessage({
        id: `cap-${index}`,
        name: `Sender ${index}`,
        email: `cap-${index}@example.com`,
        message: 'Inserted directly, so this row has no honeypot to satisfy.',
        userAgent: null,
        createdAt: new Date(Date.UTC(2030, 0, 1, 0, 0, index)).toISOString(),
      })
    }

    const response = await inbox(cookie)
    const body = contactMessagesResponseSchema.parse(await response.json())

    expect(body.data.messages.length).toBe(100)
    expect(body.data.messages.some(message => message.id === 'cap-104')).toBe(true)
    // The fifth oldest of the inserted rows is past the cap and must be gone.
    expect(body.data.messages.some(message => message.id === 'cap-4')).toBe(false)
  })
})
