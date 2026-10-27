import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from '../../../shared/config/env'
import { ValidationError } from '../../../shared/errors'
import {
  SESSION_COOKIE,
  loginInputSchema,
  logoutResponseSchema,
  sessionResponseSchema,
} from '../contract'
import { requireUser } from './guard'
import { signIn, signOut } from './service'

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
