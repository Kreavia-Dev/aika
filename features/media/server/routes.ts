import { Hono } from 'hono'
import { ValidationError } from '../../../shared/errors'
import { MAX_UPLOAD_BYTES } from '../contract'
import { atLeast, requireUser } from '../../auth'
import { mediaDeleteResponseSchema, mediaListResponseSchema, mediaUploadResponseSchema } from '../contract'
import { listMedia, removeMedia, storeUpload } from './service'

/**
 * The media feature's HTTP surface.
 *
 * Every route here is guarded, including the list. A media library is a client's
 * own assets, and there is no version of this feature where an anonymous visitor
 * should be able to enumerate them. The bytes are served by a Nitro route at
 * `/media/<filename>`, not from here, because a Hono response is an envelope and
 * an image is not.
 *
 * WHY THE BAR IS "ANY STAFF MEMBER" AND NOT "ADMINISTRATOR". Uploading an image
 * is content production, and both roles produce content. Gating this by exact
 * role would have meant an administrator could not upload either, which is the
 * opposite of what an operator expects. `atLeast('editor')` says what is meant:
 * everybody below administrator, plus administrator.
 */
export const mediaRoutes = new Hono()

/**
 * The body size check runs before the body is read.
 *
 * `parseBody` buffers the whole upload in memory, so a limit enforced after
 * parsing is a limit enforced after the damage. `Content-Length` can be absent
 * or wrong, which is why the service checks the real byte length again, but
 * this refuses the enormous case before a single byte is buffered.
 */
function assertDeclaredSizeWithinLimit(header: string | undefined): void {
  if (!header) return

  const declared = Number(header)
  if (!Number.isFinite(declared)) {
    throw new ValidationError('That upload could not be read.', ['contentLength: not a number'])
  }

  if (declared > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Files must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      [`contentLength: ${declared} is over the limit of ${MAX_UPLOAD_BYTES}`],
    )
  }
}

mediaRoutes.post('/media', atLeast('editor'), async (c) => {
  assertDeclaredSizeWithinLimit(c.req.header('content-length'))

  const body = await c.req.parseBody().catch(() => null)
  const file = body?.file

  if (!(file instanceof File)) {
    throw new ValidationError('Choose a file to upload.', ['file: no file was attached'])
  }

  /*
   * Read again rather than threaded from the guard. Hono middleware cannot hand a
   * value to the handler without widening the app's generic, so the guarded call
   * only proves who the caller is. This one is here for the id, which the record
   * needs and the middleware did not keep.
   */
  const stored = await storeUpload({
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || null,
    originalName: file.name || null,
    uploadedBy: requireUser(c).id,
  })

  return c.json(mediaUploadResponseSchema.parse({
    success: true,
    message: 'Uploaded.',
    data: { file: stored },
  }), 201)
})

mediaRoutes.get('/media', atLeast('editor'), (c) => {
  return c.json(mediaListResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { files: listMedia() },
  }))
})

/**
 * By id, not by filename. The id is the record, the filename is the address, and
 * a delete that took the address would make the URL the thing that authorises
 * the removal.
 */
mediaRoutes.delete('/media/:id', atLeast('editor'), (c) => {
  /*
   * The router requires the segment, so this cannot be empty in practice. The
   * fallback exists because the type allows it, and an empty id finds nothing,
   * which is the same answer as any other id that is not in the table.
   */
  const id = c.req.param('id') ?? ''
  const removed = removeMedia(id)

  return c.json(mediaDeleteResponseSchema.parse({
    success: true,
    message: 'Deleted.',
    data: { id: removed.id },
  }))
})
