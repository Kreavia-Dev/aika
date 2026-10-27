import { z } from 'zod'

/**
 * The `health` feature's public contract.
 *
 * Every feature declares its inputs, outputs and errors here first. Zod
 * schemas give runtime validation and TypeScript gives compile-time types
 * from the same source, see ARCHITECTURE.md, "The feature model".
 *
 * Nothing outside this feature imports from this file directly. It is
 * re-exported through `index.ts` (server boundary) and `web/index.ts`
 * (browser-safe boundary).
 */
export const healthResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    status: z.literal('ok'),
    version: z.string(),
    database: z.enum(['up', 'down']),
    uptimeSeconds: z.number().int().nonnegative(),
  }),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
