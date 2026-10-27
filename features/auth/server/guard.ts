import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { UnauthorizedError } from '../../../shared/errors'
import { SESSION_COOKIE, type PublicUser } from '../contract'
import { resolveSession } from './service'

/**
 * Reading the session off a request.
 *
 * Deliberately plain functions rather than Hono middleware, so a handler can
 * read the user without threading a generic type through every route file.
 * `authGuard` covers the case where a whole group of routes needs protecting.
 */

/** The signed-in user, or null. Never throws. */
export function currentUser(c: Context): PublicUser | null {
  return resolveSession(getCookie(c, SESSION_COOKIE))
}

/**
 * The signed-in user, or a 401.
 *
 * Call this as the first line of any handler that must not run anonymously.
 * Forgetting it is the mistake that matters, so the route tests assert the 401.
 */
export function requireUser(c: Context): PublicUser {
  const user = currentUser(c)
  if (!user) throw new UnauthorizedError()
  return user
}

/**
 * Guards a whole route group.
 *
 * ```ts
 * api.use('/admin/*', authGuard)
 * ```
 */
export async function authGuard(c: Context, next: () => Promise<void>): Promise<void> {
  requireUser(c)
  await next()
}
