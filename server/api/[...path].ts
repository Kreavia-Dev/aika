import { defineEventHandler, sendWebResponse, toWebRequest } from 'h3'
import { api } from '../../shared/http/app'

/**
 * Nitro → Hono adapter.
 *
 * This is the only bridge between the two. Keeping it this thin means the
 * Hono app in `shared/http/app.ts` stays portable: it has no Nitro imports
 * and could be served by `@hono/node-server` unchanged if that were ever
 * the better choice for a given client.
 *
 * Nitro owns `/api` entirely; no Nitro route handler may define one.
 */
export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const response = await api.fetch(request)
  return sendWebResponse(event, response)
})
