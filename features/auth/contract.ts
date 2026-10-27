import { z } from 'zod'

/**
 * The `auth` feature's public contract.
 *
 * Note what is absent: the password hash never appears in a schema, so it can
 * never be serialised into a response by accident. `publicUserSchema` is the
 * only user shape that leaves the server.
 */
export const roleSchema = z.enum(['admin', 'editor'])

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: roleSchema,
})

export const loginInputSchema = z.object({
  // Normalised here rather than in the handler, so every caller gets the same
  // treatment and the database lookup cannot miss on casing.
  email: z.string().trim().toLowerCase().min(3).max(320),
  // The upper bound is not about entropy. It is because hashing an enormous
  // string is an easy way to burn a server's CPU.
  password: z.string().min(1).max(200),
})

export const sessionResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ user: publicUserSchema }),
})

export const logoutResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ signedOut: z.literal(true) }),
})

export type Role = z.infer<typeof roleSchema>
export type PublicUser = z.infer<typeof publicUserSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type SessionResponse = z.infer<typeof sessionResponseSchema>
export type LogoutResponse = z.infer<typeof logoutResponseSchema>

/** Cookie name. Shared so the server and the browser cannot disagree. */
export const SESSION_COOKIE = 'aika_session'

/** How long a session stays valid. */
export const SESSION_TTL_DAYS = 30
