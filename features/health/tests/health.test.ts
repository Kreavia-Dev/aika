import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { healthResponseSchema } from '../contract'

/**
 * Tests the real Hono app in process, with no HTTP server and no Nuxt build.
 *
 * That is the payoff of keeping the API portable: `shared/http/app.ts` imports
 * nothing from Nitro, so a Web `Request` drives it directly. These tests run in
 * under a second instead of requiring a build.
 *
 * `response.json()` is typed `unknown`, on purpose. So every body is parsed
 * through a schema rather than asserted field by field. That is both the
 * validation and the narrowing, in one step, and it means these tests check
 * the published contract rather than a hand written copy of it.
 */
describe('GET /api/health', () => {
  it('answers 200', async () => {
    const response = await api.request('/api/health')

    expect(response.status).toBe(200)
  })

  it('conforms to the schema the feature publishes', async () => {
    const response = await api.request('/api/health')
    const parsed = healthResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })

  it('reports the database as reachable', async () => {
    const response = await api.request('/api/health')
    const body = healthResponseSchema.parse(await response.json())

    expect(body.data.database).toBe('up')
  })

  it('reports a non negative integer uptime', async () => {
    const response = await api.request('/api/health')
    const body = healthResponseSchema.parse(await response.json())

    expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(body.data.uptimeSeconds)).toBe(true)
  })

  it('is not reachable without the /api base path', async () => {
    // Nitro owns the /api prefix. Hono must not also answer at the feature root.
    const response = await api.request('/health')

    expect(response.status).toBe(404)
  })
})

describe('unknown /api routes', () => {
  it('answers with the failure envelope rather than an HTML error page', async () => {
    const response = await api.request('/api/does-not-exist')

    expect(response.status).toBe(404)

    const parsed = failureEnvelopeSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })

  it('uses the NOT_FOUND code', async () => {
    const response = await api.request('/api/does-not-exist')
    const body = failureEnvelopeSchema.parse(await response.json())

    expect(body.code).toBe('NOT_FOUND')
    expect(body.message).toBe('Endpoint not found.')
  })
})
