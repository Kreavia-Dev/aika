import type { PublicUser, SessionResponse } from '~~/features/auth/web'
import { carriesAtLeast } from '~~/features/auth/web'

/**
 * Refuses a page to a signed-in account that is not an administrator.
 *
 * Opt in from any page: `definePageMeta({ middleware: ['auth', 'admin'] })`
 *
 * WHY IT RUNS AFTER `auth` AND DOES NOT REPEAT IT. `auth` already answers the two
 * questions this middleware would otherwise have to duplicate: is there a session
 * at all, and is the API up. Listing both, in that order, keeps one owner per
 * question. A page that names only this one would send an anonymous visitor home
 * instead of to the sign in form.
 *
 * WHY THE ORDERING IS IMPORTED RATHER THAN WRITTEN HERE. `carriesAtLeast` is the
 * same function the server guard uses, so the page and the API cannot disagree
 * about who is allowed in. A second copy of "admin is above editor" is exactly the
 * kind of thing that stays correct until somebody adds a role.
 *
 * WHY THIS ONE FETCHES WHEN `auth` ALREADY DID. The middleware chain discards what
 * a previous middleware learned, and threading it through would mean a shared
 * store for one string. It is one loopback request on the pages that ask for it,
 * which is a handful of staff screens, and the alternative is a cache with an
 * invalidation question attached. If a role change mid-session ever matters here,
 * the API is still the authority and refuses the data.
 *
 * WHY A REDIRECT AND NOT AN ERROR. An editor who opens a page they will never be
 * allowed to use does not need a dead end. The home page is somewhere they can
 * act, and the API refuses the data regardless, so nothing is exposed by being
 * friendly about it.
 *
 * WHY `useRequestFetch` HERE TOO. Same reason as `auth.ts`: on the server a plain
 * fetch drops the incoming cookies, and every signed-in visitor would be read as
 * anonymous. That failure only shows up in server rendering.
 *
 * This lives in `app/` because it is the shell's business, not a feature's. A
 * client that reworks its shell can rewrite it without touching a feature.
 */
function statusCodeOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode: unknown }).statusCode
    if (typeof statusCode === 'number') return statusCode
  }

  return null
}

export default defineNuxtRouteMiddleware(async () => {
  const requestFetch = useRequestFetch()

  let user: PublicUser

  try {
    const session = await requestFetch<SessionResponse>('/api/auth/me')
    user = session.data.user
  }
  catch (error) {
    if (statusCodeOf(error) === 401) {
      return navigateTo('/auth/login')
    }

    return showError({
      statusCode: 503,
      statusMessage: 'Sign in is temporarily unavailable. Please try again in a moment.',
    })
  }

  if (!carriesAtLeast(user.role, 'admin')) {
    return navigateTo('/')
  }
})
