import { createError, defineEventHandler, getRouterParam, send, setHeader } from 'h3'
import { readMediaFile } from '../../../features/media'

/**
 * Uploaded files, served.
 *
 * A Nitro route rather than a Hono one, for the same reason robots.txt and
 * sitemap.xml are: Hono is reached through exactly one adapter and owns `/api`,
 * where every response is a JSON envelope. An image is not an envelope, and
 * wrapping one in an envelope to satisfy a convention would be worse than the
 * convention.
 *
 * WHY `nosniff` IS SET. The upload endpoint only accepts four image types, so
 * this should never matter. It is set anyway because the cost is one header and
 * the failure it prevents, a browser deciding a file is HTML because of its
 * content, is a stored cross site scripting bug rather than a rendering glitch.
 *
 * WHY `immutable`. The filename is a UUID that is never reused, so a cached copy
 * can never be stale. This is the one place in Aika where that is true, and it
 * is worth the aggressive header.
 */
export default defineEventHandler((event) => {
  const filename = getRouterParam(event, 'filename') ?? ''
  const file = readMediaFile(filename)

  /*
   * A name that was never uploaded, a row whose file has gone missing, and a
   * path traversal attempt all get the same answer. There is nothing useful to
   * tell an anonymous visitor about which of the three it was.
   */
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  setHeader(event, 'content-type', file.contentType)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')

  return send(event, Buffer.from(file.bytes))
})
