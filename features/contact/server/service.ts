import { randomUUID } from 'node:crypto'
import type { ContactInput } from '../contract'
import { insertContactMessage } from './repository'

/** How much of an attacker controlled header is worth keeping. */
const MAX_USER_AGENT = 300

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
