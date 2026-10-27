/**
 * Refuses anonymous access to a page.
 *
 * Opt in from any page: `definePageMeta({ middleware: 'auth' })`
 *
 * WHY `useRequestFetch` AND NOT `useFetch`. On the server, a plain fetch does
 * not carry the incoming request's cookies. An authenticated visitor would then
 * be treated as signed out and redirected to the login page on every hard
 * navigation, while working fine after client side navigation. That bug only
 * appears in SSR, which is exactly when nobody is watching.
 *
 * WHY THE TWO ERROR PATHS. A 401 means "sign in" and nothing else does. If the
 * API is briefly unreachable, which happens during every PM2 reload, treating
 * that as a 401 sends the visitor to a login form that also cannot reach the
 * API, so a correct password appears to be rejected. An outage is reported as
 * an outage instead.
 *
 * This middleware goes through the API rather than importing the auth feature.
 * The application is allowed to import a feature, but routing the check through
 * HTTP keeps the guard working however the auth feature stores sessions later.
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

  try {
    await requestFetch('/api/auth/me')
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
})
