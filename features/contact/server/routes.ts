import { Hono } from 'hono'
import { requireRole } from '../../auth'
import { ValidationError } from '../../../shared/errors'
import {
  contactInputSchema,
  contactMessagesResponseSchema,
  contactResponseSchema,
} from '../contract'
import { listMessages, submitContactMessage } from './service'

export const contactRoutes = new Hono()

/**
 * Public on purpose. A contact form that requires a sign in is a contact form
 * nobody fills in.
 */
contactRoutes.post('/contact', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = contactInputSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      'Please check the form and try again.',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    )
  }

  submitContactMessage(parsed.data, { userAgent: c.req.header('user-agent') ?? null })

  // The same answer whether it was stored or dropped as spam. See the service.
  return c.json(contactResponseSchema.parse({
    success: true,
    message: 'Thanks. We will be in touch.',
    data: { received: true },
  }))
})

/**
 * The staff inbox, behind the guard.
 *
 * This is the cross-feature dependency the architecture allows: `contact` reads
 * `requireRole` through `features/auth/index.ts`, its public door. Rule R2 refuses
 * reaching into `features/auth/server/...`, and R5 refuses it the other way
 * round, so the graph stays a tree rather than a knot.
 *
 * A guarded route is the only thing standing between a visitor and every message
 * a client has received, so the guard goes first and is deliberately obvious.
 *
 * WHY ADMINISTRATOR ONLY, AND NOT EVERY MEMBER OF STAFF. An inbox is everything a
 * client's visitors have ever sent, which includes personal data about people who
 * never agreed to be in a database. Producing content is not the same act as
 * reading a stranger's enquiry, so the media library's bar does not apply here.
 *
 * WHY THE INLINE CALL AND NOT `roleGuard`. This router is shared with the public
 * `POST /contact`, so a `use` would have to be scoped to a path that does not
 * wrap the public route, and one handler is one line. The inline call as the first
 * line is the convention AGENTS.md gives for a single handler.
 */
contactRoutes.get('/contact/messages', (c) => {
  requireRole(c, 'admin')

  return c.json(contactMessagesResponseSchema.parse({
    success: true,
    message: 'Recent messages.',
    data: { messages: listMessages() },
  }))
})
