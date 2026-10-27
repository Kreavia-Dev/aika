import { z } from 'zod'

/**
 * The failure envelope every `/api` response uses.
 *
 * It lives in `shared/http/` rather than in a feature because
 * `shared/http/app.ts` is the single place that produces it. Every feature's
 * error is mapped there, so the shape is genuinely shared.
 *
 * The success envelope is not here, and deliberately so: its `data` payload is
 * owned by the feature that returns it. A shared generic wrapper for that
 * would be a hand written generic, which this project does not want. Each
 * feature declares its own success envelope in its `contract.ts`, which also
 * means each feature's response shape is validated where it is defined.
 *
 * `AGENTS.md` states that every response uses the envelope. This file is what
 * turns that statement into something the compiler and the tests can check.
 */
export const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string(),
  errors: z.array(z.string()).optional(),
})

export type FailureEnvelope = z.infer<typeof failureEnvelopeSchema>
