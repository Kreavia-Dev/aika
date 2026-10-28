import { z } from 'zod'

/**
 * The `auth` feature's public contract.
 *
 * Note what is absent: the password hash never appears in a schema, so it can
 * never be serialised into a response by accident. `publicUserSchema` is the
 * only user shape that leaves the server.
 */
export const roleSchema = z.enum(['admin', 'editor'])

export type Role = z.infer<typeof roleSchema>

/**
 * Whether a role carries at least as much authority as another.
 *
 * WHY THIS IS A PLAIN `if` CHAIN AND NOT A RANK NUMBER. There are two roles, and
 * their order is a decision a person made rather than a value a type system can
 * derive. A numeric rank on `roleSchema`, or a column beside it, invites the next
 * reader to assume `1 < 2` means something and to add a third role by picking a
 * number. When a third role exists, somebody has to sit down and decide where it
 * sits, and this function is where they will look.
 *
 * WHY IT LIVES IN THE CONTRACT RATHER THAN THE SERVER. The browser needs the same
 * answer. A page that is administrator only has to decide whether to show itself,
 * and if it asked a second copy of this question the two could disagree, which is
 * the kind of disagreement that shows up as a screen that renders for the wrong
 * person. There is one answer, and both boundaries import it.
 *
 * Two explicit branches, no default, so adding a role to `roleSchema` leaves a
 * path with no return and `npm run check` fails until somebody writes down where
 * the new role sits.
 */
export function carriesAtLeast(role: Role, required: Role): boolean {
  if (role === 'admin') {
    // An administrator carries every role below them.
    return true
  }

  if (role === 'editor') {
    // An editor carries editor authority, and nothing above it.
    return required === 'editor'
  }

  /*
   * Unreachable while there are two roles: the two branches above cover both, and
   * `Role` is checked exhaustively by the compiler. This exists so the function
   * has a return on every path if a third role is added.
   */
  throw new Error(`Role ${role satisfies never} has no place in the ordering yet.`)
}

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: roleSchema,
})

/**
 * The shortest password Aika accepts.
 *
 * Twelve characters, and deliberately no composition rules. Demanding a digit and
 * a symbol is how you get `Password1!`, which is weaker than a longer phrase.
 * Length is the part that actually helps, and the generated password from
 * `npm run user:create` clears this by a wide margin.
 *
 * The browser is not told this number. The change password form relies on
 * `required` and shows the server's refusal, which costs one round trip for an
 * action nobody performs weekly. Copying the number into a component is how the
 * two drift apart, and the server is the authority either way.
 */
export const MIN_PASSWORD_LENGTH = 12

export const loginInputSchema = z.object({
  // Normalised here rather than in the handler, so every caller gets the same
  // treatment and the database lookup cannot miss on casing.
  email: z.string().trim().toLowerCase().min(3).max(320),
  // The upper bound is not about entropy. It is because hashing an enormous
  // string is an easy way to burn a server's CPU.
  password: z.string().min(1).max(200),
})

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
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

export const changePasswordResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    changed: z.literal(true),
    /**
     * How many other sessions were ended. Zero is the ordinary case, and a
     * number above zero is the interesting one: it means somebody else's
     * browser was signed in as this user.
     */
    otherSessionsRevoked: z.number().int(),
  }),
})

/**
 * An account as the admin list route returns it.
 *
 * Built on `publicUserSchema` rather than restated, so the two cannot disagree
 * about what a user is. The extra two fields are the lifecycle, not the
 * identity: when the row was made and whether access has been revoked.
 */
export const accountSchema = publicUserSchema.extend({
  createdAt: z.string(),
  disabledAt: z.string().nullable(),
})

export const accountListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ accounts: z.array(accountSchema) }),
})

export type PublicUser = z.infer<typeof publicUserSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>
export type SessionResponse = z.infer<typeof sessionResponseSchema>
export type LogoutResponse = z.infer<typeof logoutResponseSchema>
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>
export type Account = z.infer<typeof accountSchema>
export type AccountListResponse = z.infer<typeof accountListResponseSchema>

/** Cookie name. Shared so the server and the browser cannot disagree. */
export const SESSION_COOKIE = 'aika_session'

/** How long a session stays valid. */
export const SESSION_TTL_DAYS = 30
