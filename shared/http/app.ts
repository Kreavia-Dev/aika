import { Hono } from 'hono'
import { authRoutes } from '../../features/auth'
import { healthRoutes } from '../../features/health'
import { AppError, ValidationError } from '../errors'
import type { FailureEnvelope } from './envelope'

/**
 * The server composition root.
 *
 * This is one of the few files upstream and downstream are allowed to
 * disagree about. Everything a client project adds should be a line here
 * mounting that client's own feature, nothing more.
 *
 * Nitro owns the HTTP server; Hono owns every `/api` route.
 * See `server/api/[...path].ts` for the adapter.
 *
 * Every error response is annotated as `FailureEnvelope`, so a change to the
 * envelope shape breaks the build here rather than surprising a client.
 */
export const api = new Hono().basePath('/api')

api.onError((error, c) => {
  if (error instanceof ValidationError) {
    const payload: FailureEnvelope = {
      success: false,
      message: error.message,
      code: error.code,
      errors: [...error.issues],
    }

    return c.json(payload, error.status)
  }

  if (error instanceof AppError) {
    const payload: FailureEnvelope = {
      success: false,
      message: error.message,
      code: error.code,
    }

    return c.json(payload, error.status)
  }

  // Unexpected. Log the real thing, return nothing internal to the client.
  console.error('[aika] unhandled error', error)

  const payload: FailureEnvelope = {
    success: false,
    message: 'Something went wrong on our side.',
    code: 'INTERNAL_ERROR',
  }

  return c.json(payload, 500)
})

api.notFound((c) => {
  const payload: FailureEnvelope = {
    success: false,
    message: 'Endpoint not found.',
    code: 'NOT_FOUND',
  }

  return c.json(payload, 404)
})

// Feature mounts. Add one line per feature, in any order.
api.route('/', authRoutes)
api.route('/', healthRoutes)
