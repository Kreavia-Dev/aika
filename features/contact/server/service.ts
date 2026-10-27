import { randomUUID } from 'node:crypto'
import type { ContactInput, ContactMessage } from '../contract'
import { findRecentMessages, insertContactMessage } from './repository'

/** How much of an attacker controlled header is worth keeping. */
const MAX_USER_AGENT = 300

/**
 * How many messages the inbox shows.
 *
 * A constant rather than a query parameter, because the inbox has no pagination
 * and an unbounded read is how a page starts timing out a year from now.
 */
const MAX_MESSAGES = 100

export type SubmissionContext = {
  userAgent: string | null
}

/**
 * Stores a submission.
 *
 * The honeypot is checked here rather than in the route, so the rule can be
 * tested without going through HTTP, and so there is one place that decides what
 * counts as spam.
 *
 * It answers as though it succeeded rather than reporting a failure. A bot that
 * is told it was caught is a bot that gets retuned, and the visitor who filled
 * the hidden field by accident sees nothing strange.
 */
export function submitContactMessage(input: ContactInput, context: SubmissionContext): void {
  const filledTheHoneypot = (input.website ?? '').length > 0
  if (filledTheHoneypot) return

  insertContactMessage({
    id: randomUUID(),
    name: input.name,
    email: input.email,
    message: input.message,
    userAgent: context.userAgent?.slice(0, MAX_USER_AGENT) ?? null,
    createdAt: new Date().toISOString(),
  })
}

/**
 * The inbox.
 *
 * This is where a storage row becomes a contract shape. The repository hands over
 * `created_at` and `user_agent`, and nothing outside this feature ever sees
 * snake_case. Keeping the mapping in one place is what lets the table change
 * without the API changing, and the other way round.
 */
export function listMessages(): ContactMessage[] {
  return findRecentMessages(MAX_MESSAGES).map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))
}
