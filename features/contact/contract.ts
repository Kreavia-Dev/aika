import { z } from 'zod'

/**
 * The `contact` feature's public contract.
 *
 * This feature is mostly a backend slice, and the split it makes is the split
 * most features should make:
 *
 *   The PLUMBING is here: the shape of a submission, the rules, the table, and
 *   the endpoints. Every client wants the same plumbing.
 *
 *   The PUBLIC UI is the client's: `app/pages/contact.vue` and
 *   `app/components/ContactForm.vue`. Every client words a contact page
 *   differently, and plenty of them change the fields.
 *
 * But the feature does own one screen, the staff inbox at `/contact/messages`,
 * and that is not a contradiction. The test is "will every client want the same
 * thing here", not "is it UI". A contact form is branding. An inbox is tooling,
 * and no client wants to rewrite one. `docs/aika/ARCHITECTURE.md` has the table.
 */
export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  // A minimum length, because "hi" is not a message and answering it wastes
  // somebody's afternoon.
  message: z.string().trim().min(10).max(5000),
  /**
   * The honeypot.
   *
   * Hidden from visitors with CSS, so a person leaves it empty and a naive bot
   * fills it in. Bounded rather than unbounded, so an enormous value is still
   * cheap to reject.
   *
   * This is not real spam protection. It stops the cheapest scripts and nothing
   * else, and anything more serious belongs at the edge. It is here because a
   * public form with no thought given to spam fills up within a week.
   */
  website: z.string().max(200).optional(),
})

export const contactResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ received: z.literal(true) }),
})

/**
 * A message as staff see it.
 *
 * `userAgent` is exposed on purpose. It is the cheapest signal for telling a
 * person from a script, and the inbox is the place where that judgement gets
 * made. It is never shown to a visitor, and it is the only field here that is
 * not part of what the sender typed.
 */
export const contactMessageSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  message: z.string(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
})

export const contactMessagesResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ messages: z.array(contactMessageSchema) }),
})

export type ContactInput = z.infer<typeof contactInputSchema>
export type ContactResponse = z.infer<typeof contactResponseSchema>
export type ContactMessage = z.infer<typeof contactMessageSchema>
export type ContactMessagesResponse = z.infer<typeof contactMessagesResponseSchema>
