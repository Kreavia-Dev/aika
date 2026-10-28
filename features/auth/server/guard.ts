import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors'
import { SESSION_COOKIE, carriesAtLeast, type PublicUser, type Role } from '../contract'
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
 * Why the message is one sentence and says nothing about roles.
 *
 * An editor who is told "admins only, you are an editor" learns the shape of
 * every screen they cannot reach, and can pass that on. The honest, useless
 * version is the one below: the action needs a role you do not have.
 */
const ROLE_ERROR = 'This action needs a role your account does not have.'

/**
 * The signed-in user, if their role matches, or a 401, then a 403.
 *
 * Authorisation in Aika is by role only, not per resource. Every account belongs
 * to the same studio, so there is no owner of a row and no "this user may edit
 * this one" rule. Do not invent one here: a per-resource check needs a column
 * saying who owns it, and no table has one.
 *
 * Call this as the first line of any handler that is admin only, the same way
 * `requireUser` opens a handler that is signed-in only.
 *
 * TWO DIFFERENT TOOLS, DO NOT SWAP THEM. This one answers "exactly this role",
 * and is right when the answer really is one role and nobody else, such as
 * listing every account. `requireAtLeast` below answers "at least this much
 * authority", and is right when a more senior role should also pass, such as
 * content work that an administrator does as well as an editor.
 */
export function requireRole(c: Context, role: Role): PublicUser {
  const user = requireUser(c)
  if (user.role !== role) throw new ForbiddenError(ROLE_ERROR)
  return user
}

/**
 * The signed-in user, if their role carries at least `role`, or a 401, then a 403.
 *
 * `requireAtLeast(c, 'editor')` admits both roles, because an administrator can
 * do everything an editor can. `requireAtLeast(c, 'admin')` admits only an
 * administrator, and gives the same answer as `requireRole(c, 'admin')`.
 *
 * This is the guard for content work: a media library, a draft, a page. Use it
 * rather than `requireRole` wherever the intent is "any member of staff who is
 * allowed to produce content", because the exact match refuses the administrator
 * and that is backwards from what every operator expects.
 */
export function requireAtLeast(c: Context, role: Role): PublicUser {
  const user = requireUser(c)
  /*
   * The rule itself lives in `../contract`, because a browser page has to reach
   * the same verdict and two copies would eventually disagree.
   */
  if (!carriesAtLeast(user.role, role)) throw new ForbiddenError(ROLE_ERROR)
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

/**
 * Guards a whole route group by role.
 *
 * ```ts
 * api.use('/admin/*', roleGuard('admin'))
 * ```
 *
 * The exact match. For "any staff member with this much authority", use
 * `atLeast` below instead.
 */
export function roleGuard(role: Role) {
  return async (c: Context, next: () => Promise<void>): Promise<void> => {
    requireRole(c, role)
    await next()
  }
}

/**
 * Guards a whole route group by minimum authority.
 *
 * ```ts
 * api.use('/media/*', atLeast('editor'))
 * ```
 *
 * The middleware form of `requireAtLeast`. Prefer the inline call for one handler
 * on a shared router, and this for a group, the same split as `requireUser` and
 * `authGuard`.
 */
export function atLeast(role: Role) {
  return async (c: Context, next: () => Promise<void>): Promise<void> => {
    requireAtLeast(c, role)
    await next()
  }
}
