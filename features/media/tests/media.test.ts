import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { createUser } from '../../auth'
import {
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  mediaDeleteResponseSchema,
  mediaListResponseSchema,
  mediaUploadResponseSchema,
} from '../contract'
import { readMediaFile } from '../server/service'

/**
 * Drives the real Hono app in process, the same way the other features do.
 *
 * WHAT THIS FILE CANNOT REACH. The bytes are served by a Nitro route
 * (`server/routes/media/[filename].ts`), and this suite talks to Hono directly,
 * so the serving route is not exercised here. What is exercised is
 * `readMediaFile`, which is everything that route decides with, plus the
 * behaviour of every route Hono owns.
 *
 * Real images are generated with sharp rather than faked, because the feature
 * now reads the bytes. A three byte buffer that claims to be a PNG is exactly
 * what the validation exists to refuse.
 */

const PASSWORD = 'a password long enough to be hashed without complaint'

async function signIn(): Promise<string> {
  const email = `media-${randomUUID()}@example.com`
  await createUser({ email, password: PASSWORD })

  const response = await api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })

  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

async function upload(cookie: string | undefined, file: File): Promise<Response> {
  const body = new FormData()
  body.append('file', file)

  return api.request('/api/media', {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    body,
  })
}

async function list(cookie: string): Promise<Response> {
  return api.request('/api/media', { headers: { cookie } })
}

async function remove(cookie: string | undefined, id: string): Promise<Response> {
  return api.request(`/api/media/${id}`, {
    method: 'DELETE',
    headers: cookie ? { cookie } : {},
  })
}

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type })
}

/** A real JPEG, wider than the limit, so it has to be shrunk. */
async function wideJpeg(width = 3000, height = 2000): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 12, g: 34, b: 56 } },
  }).jpeg().toBuffer()
}

/** A real PNG, already inside the limit, so it must be stored untouched. */
async function smallPng(): Promise<Buffer> {
  return sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 1, g: 2, b: 3 } },
  }).png().toBuffer()
}

async function uploadPng(cookie: string): Promise<{ id: string, filename: string }> {
  const created = mediaUploadResponseSchema.parse(
    await (await upload(cookie, fileFrom(await smallPng(), 'picture.png', 'image/png'))).json(),
  )

  return { id: created.data.file.id, filename: created.data.file.filename }
}

describe('media', () => {
  it('refuses an upload from a signed out visitor', async () => {
    // This refusal is the only thing between the public internet and a client's
    // storage directory.
    const response = await upload(undefined, fileFrom(await smallPng(), 'x.png', 'image/png'))

    expect(response.status).toBe(401)
  })

  it('refuses to list files for a signed out visitor', async () => {
    expect((await api.request('/api/media')).status).toBe(401)
  })

  it('refuses to delete for a signed out visitor', async () => {
    const response = await remove(undefined, '00000000-0000-0000-0000-000000000000')

    expect(response.status).toBe(401)
  })

  it('stores an upload and returns it in the contract shape', async () => {
    const cookie = await signIn()
    const response = await upload(cookie, fileFrom(await smallPng(), 'holiday.png', 'image/png'))

    expect(response.status).toBe(201)

    const body = mediaUploadResponseSchema.parse(await response.json())
    expect(body.data.file.originalName).toBe('holiday.png')
    expect(body.data.file.contentType).toBe('image/png')
    expect(body.data.file.url).toBe(`/media/${body.data.file.filename}`)
  })

  it('makes the stored bytes reachable through the service the route uses', async () => {
    const cookie = await signIn()
    const created = mediaUploadResponseSchema.parse(
      await (await upload(cookie, fileFrom(await smallPng(), 'x.png', 'image/png'))).json(),
    )

    const served = readMediaFile(created.data.file.filename)

    expect(served).not.toBeNull()
    expect(served?.contentType).toBe('image/png')
  })

  it('stores an image that already fits byte for byte', async () => {
    // Not re-encoded. Re-encoding a JPEG that was already the right size would
    // lose a little quality on every upload for no benefit.
    const cookie = await signIn()
    const source = await smallPng()
    const created = mediaUploadResponseSchema.parse(
      await (await upload(cookie, fileFrom(source, 'small.png', 'image/png'))).json(),
    )

    expect(created.data.file.byteSize).toBe(source.byteLength)

    const served = readMediaFile(created.data.file.filename)
    expect(Buffer.from(served?.bytes ?? []).equals(source)).toBe(true)
  })

  it('shrinks an image that is over the limit, and records the size as stored', async () => {
    const cookie = await signIn()
    const source = await wideJpeg(3000, 2000)
    const response = await upload(cookie, fileFrom(source, 'huge.jpg', 'image/jpeg'))

    expect(response.status).toBe(201)

    const created = mediaUploadResponseSchema.parse(await response.json())

    // The recorded size is the size on disk, not the size that arrived. A library
    // screen that reported the original would be lying about what it serves.
    expect(created.data.file.byteSize).toBeLessThan(source.byteLength)

    const served = readMediaFile(created.data.file.filename)
    const metadata = await sharp(Buffer.from(served?.bytes ?? [])).metadata()

    expect(metadata.width).toBe(MAX_IMAGE_DIMENSION)
    expect(metadata.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION)
    expect(metadata.height).toBe(1280)
  })

  it('refuses bytes that are not an image, whatever the upload claimed', async () => {
    /*
     * This test used to assert the opposite, as a recorded limitation: a file
     * that claimed to be a PNG was accepted, and the mitigation was that the
     * serving route sets a content type and nosniff. The resize step now reads
     * the bytes, so the claim is no longer trusted and the limitation is closed.
     */
    const cookie = await signIn()
    const lying = fileFrom(Buffer.from('<html>not an image</html>'), 'evil.png', 'image/png')

    const response = await upload(cookie, lying)

    expect(response.status).toBe(422)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a type that is not on the accepted list', async () => {
    const cookie = await signIn()
    const response = await upload(cookie, fileFrom(await smallPng(), 'notes.txt', 'text/plain'))

    expect(response.status).toBe(422)
  })

  it('rejects an SVG, which is a document rather than an image', async () => {
    // Kept as a test rather than a comment so that adding image/svg+xml to the
    // accepted list fails here, loudly, with this reason attached.
    const cookie = await signIn()
    const svg = fileFrom(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      'x.svg',
      'image/svg+xml',
    )

    expect((await upload(cookie, svg)).status).toBe(422)
  })

  it('rejects a file with no bytes', async () => {
    const cookie = await signIn()
    const response = await upload(cookie, fileFrom(new Uint8Array(), 'empty.png', 'image/png'))

    expect(response.status).toBe(422)
  })

  it('ignores the filename the browser supplied when building the path on disk', async () => {
    // The stored name is generated from a UUID, so this is what makes traversal
    // impossible rather than merely filtered.
    const cookie = await signIn()
    const response = await upload(cookie, fileFrom(await smallPng(), '../../../etc/passwd.png', 'image/png'))
    const body = mediaUploadResponseSchema.parse(await response.json())

    expect(body.data.file.filename).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    )
    expect(body.data.file.filename).not.toContain('..')
    expect(body.data.file.originalName).toBe('../../../etc/passwd.png')
  })

  it('lists what was uploaded', async () => {
    const cookie = await signIn()
    const { id } = await uploadPng(cookie)

    const body = mediaListResponseSchema.parse(await (await list(cookie)).json())

    expect(body.data.files.some(file => file.id === id)).toBe(true)
  })

  it('deletes the record and the bytes together', async () => {
    const cookie = await signIn()
    const { id, filename } = await uploadPng(cookie)

    expect(readMediaFile(filename)).not.toBeNull()

    const response = await remove(cookie, id)

    expect(response.status).toBe(200)
    expect(mediaDeleteResponseSchema.parse(await response.json()).data.id).toBe(id)

    // The URL stops resolving, and the file is not merely orphaned on disk.
    expect(readMediaFile(filename)).toBeNull()

    const after = mediaListResponseSchema.parse(await (await list(cookie)).json())
    expect(after.data.files.some(file => file.id === id)).toBe(false)
  })

  it('answers 404 when asked to delete something that is not there', async () => {
    const cookie = await signIn()
    const response = await remove(cookie, '00000000-0000-0000-0000-000000000000')

    expect(response.status).toBe(404)
  })

  it('refuses an over sized upload from the declared length, before reading the body', async () => {
    const cookie = await signIn()

    const response = await api.request('/api/media', {
      method: 'POST',
      headers: { cookie, 'content-length': String(MAX_UPLOAD_BYTES + 1) },
      body: 'not really that big',
    })

    expect(response.status).toBe(422)
  })

  it('answers an anonymous over sized request with 401 rather than 422', async () => {
    /*
     * The guard runs before the handler, so an anonymous request is refused
     * before any size reasoning happens at all. That is the right order, since
     * there is no reason to spend work on a request that cannot succeed.
     *
     * This test exists because the first version of the test above asserted 422
     * here and failed. The code was right and the test was wrong, and the
     * correct behaviour is worth keeping written down.
     */
    const response = await api.request('/api/media', {
      method: 'POST',
      headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1) },
      body: 'not really that big',
    })

    expect(response.status).toBe(401)
  })

  it('does not attempt to serve a name that was never uploaded', () => {
    expect(readMediaFile('../../database/aika.db')).toBeNull()
    expect(readMediaFile('00000000-0000-0000-0000-000000000000.png')).toBeNull()
  })
})
