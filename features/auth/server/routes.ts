import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from '../../../shared/config/env'
import { ValidationError } from '../../../shared/errors'
import {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE,
  changePasswordInputSchema,
  changePasswordResponseSchema,
  loginInputSchema,
  logoutResponseSchema,
  sessionResponseSchema,
} from '../contract'
import { requireUser } from './guard'
import { changePassword, signIn, signOut } from './service'

export const authRoutes = new Hono()

authRoutes.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginInputSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      'Email or password is invalid.',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    )
  }

  const { user, token, expiresAt } = await signIn(parsed.data.email, parsed.data.password)

  setCookie(c, SESSION_COOKIE, token, {
    // Not readable from JavaScript, so an XSS bug cannot lift the session.
    httpOnly: true,
    // Lax still sends the cookie on top level navigation, and blocks it on
    // cross-site form posts, which covers the CSRF cases that matter here.
    sameSite: 'Lax',
    // Off in development, because there is no TLS on localhost.
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  return c.json(sessionResponseSchema.parse({
    success: true,
    message: 'Signed in.',
    data: { user },
  }))
})

authRoutes.post('/auth/logout', (c) => {
  // Deletes the row, so the token stops working even if the cookie is kept.
  signOut(getCookie(c, SESSION_COOKIE))
  deleteCookie(c, SESSION_COOKIE, { path: '/' })

  return c.json(logoutResponseSchema.parse({
    success: true,
    message: 'Signed out.',
    data: { signedOut: true },
  }))
})

authRoutes.get('/auth/me', (c) => {
  const user = requireUser(c)

  return c.json(sessionResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { user },
  }))
})

/**
 * Changing your own password.
 *
 * There is no route for changing somebody else's, and no route for revoking an
 * account. Both are shell commands, because revocation is an action taken by
 * whoever runs the deployment, and a web route would let any signed-in user lock
 * out any other while every account is an administrator.
 */
authRoutes.post('/auth/password', async (c) => {
  /*
   * The documented first line for a handler that must not run anonymously, even
   * though `changePassword` refuses an absent session by itself. The extra cost
   * is one indexed select on an action nobody performs weekly, and it keeps the
   * convention visible where a reader looks for it. The route tests assert the
   * 401 this produces.
   */
  requireUser(c)

  const body = await c.req.json().catch(() => null)
  const parsed = changePasswordInputSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      `Please check the form. A new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    )
  }

  const { otherSessionsRevoked } = await changePassword({
    token: getCookie(c, SESSION_COOKIE),
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  })

  return c.json(changePasswordResponseSchema.parse({
    success: true,
    message: otherSessionsRevoked === 0
      ? 'Password changed. Your other devices were already signed out.'
      : `Password changed, and ${otherSessionsRevoked} other session(s) were signed out.`,
    data: { changed: true, otherSessionsRevoked },
  }))
})
