import { Hono } from 'hono'
import { pingDatabase } from '../../../shared/database/client'
import { env } from '../../../shared/config/env'
import { healthResponseSchema, type HealthResponse } from '../contract'

/**
 * Liveness and readiness in one endpoint.
 *
 * `database: 'down'` still returns 200: the process is alive and the check
 * should be readable by a human. Deploy scripts that need to gate a release
 * should assert on `data.database === 'up'`, not on the HTTP status alone.
 */
export const healthRoutes = new Hono()

healthRoutes.get('/health', (c) => {
  const payload: HealthResponse = {
    success: true,
    message: 'OK',
    data: {
      status: 'ok',
      version: env.APP_VERSION,
      database: pingDatabase() ? 'up' : 'down',
      uptimeSeconds: Math.round(process.uptime()),
    },
  }

  // Parse on the way out. This is where a contract drift becomes a loud
  // failure in development instead of a silent shape change in production.
  return c.json(healthResponseSchema.parse(payload))
})
