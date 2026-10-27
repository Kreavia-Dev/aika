import { Hono } from 'hono'
import { ValidationError } from '../../../shared/errors'
import { contactInputSchema, contactResponseSchema } from '../contract'
import { submitContactMessage } from './service'

/**
 * The contact endpoints.
 *
 * Public on purpose. A contact form that requires a sign in is a contact form
 * nobody fills in.
 */
export const contactRoutes = new Hono()

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
