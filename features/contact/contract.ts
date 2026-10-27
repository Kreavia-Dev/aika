import { z } from 'zod'

/**
 * The `contact` feature's public contract.
 *
 * This feature is a pure backend slice, and the split it makes is the split most
 * features should make:
 *
 *   The WHOLE feature is plumbing: the shape of a submission, the rules, the
 *   table, and the endpoint. Every client wants the same plumbing.
 *
 *   ALL of the UI is the client's: `app/pages/contact.vue` and
 *   `app/components/ContactForm.vue`. Every client words a contact page
 *   differently, and plenty of them change the fields.
 *
 * The dividing line is not "frontend versus backend". It is "what every client
 * shares versus what only this client has". Shared UI would be wrong even if it
 * were perfectly reusable, because an upstream change to a file the client has
 * also edited is a merge conflict, and the client edits the wording of their own
 * contact page every time.
 *
 * The counterexample is `features/health` and `features/auth`, which DO own pages.
 * Those are tooling screens rather than branded ones: a status panel and a sign
 * in form look the same for every client, and no client wants to rewrite them.
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

export type ContactInput = z.infer<typeof contactInputSchema>
export type ContactResponse = z.infer<typeof contactResponseSchema>
