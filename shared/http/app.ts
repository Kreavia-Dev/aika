import { Hono } from 'hono'
import { healthRoutes } from '../../features/health'
import { AppError, ValidationError } from '../errors'

/**
 * The server composition root.
 *
 * This is one of the few files upstream and downstream are allowed to
 * disagree about. Everything a client project adds should be a line here
 * mounting that client's own feature. Nothing more.
 *
 * Nitro owns the HTTP server; Hono owns every `/api` route.
 * See `server/api/[...path].ts` for the adapter.
 */
export const api = new Hono().basePath('/api')

api.onError((error, c) => {
  if (error instanceof ValidationError) {
    return c.json(
      {
        success: false as const,
        message: error.message,
        code: error.code,
        errors: [...error.issues],
      },
      error.status,
    )
  }

  if (error instanceof AppError) {
    return c.json(
      { success: false as const, message: error.message, code: error.code },
      error.status,
    )
  }

  // Unexpected: log the real thing, return nothing internal to the client.
  console.error('[aika] unhandled error', error)

  return c.json(
    {
      success: false as const,
      message: 'Something went wrong on our side.',
      code: 'INTERNAL_ERROR',
    },
    500,
  )
})

api.notFound(c =>
  c.json(
    { success: false as const, message: 'Endpoint not found.', code: 'NOT_FOUND' },
    404,
  ),
)

// ── Feature mounts ───────────────────────────────────────────────────────────
api.route('/', healthRoutes)
