import { Hono } from 'hono'
import { authGuard } from '../../auth'
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
 * `authGuard` through `features/auth/index.ts`, its public door. Rule R2 refuses
 * reaching into `features/auth/server/...`, and R5 refuses it the other way
 * round, so the graph stays a tree rather than a knot.
 *
 * A guarded route is the only thing standing between a visitor and every message
 * a client has received, so the guard goes first and is deliberately obvious.
 */
contactRoutes.get('/contact/messages', authGuard, (c) => {
  return c.json(contactMessagesResponseSchema.parse({
    success: true,
    message: 'Recent messages.',
    data: { messages: listMessages() },
  }))
})
