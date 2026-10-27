import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { createUser } from '../../auth'
import { MAX_UPLOAD_BYTES, mediaListResponseSchema, mediaUploadResponseSchema } from '../contract'
import { readMediaFile } from '../server/service'

/**
 * Drives the real Hono app in process, the same way the other features do.
 *
 * WHAT THIS FILE CANNOT REACH. The bytes are served by a Nitro route
 * (`server/routes/media/[filename].get.ts`), and this suite talks to Hono
 * directly, so the serving route is not exercised here. What is exercised is
 * `readMediaFile`, which is everything that route decides with. The route itself
 * is thin enough that the built server check in CI is the right place for it.
 */

const PASSWORD = 'a password long enough to be hashed without complaint'

/**
 * The smallest thing that behaves like an image for these tests.
 *
 * The feature does not inspect image contents, it trusts the content type the
 * upload declared. That is a known limitation, recorded by the test at the
 * bottom of this file, and it is why a three byte buffer is enough here.
 */
const TINY_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

async function signIn(): Promise<string> {
  const email = `media-${randomUUID()}@example.com`
  const user = await createUser({ email, password: PASSWORD })

  const response = await api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })

  // The feature needs a real account id, so the cookie alone is not enough.
  void user

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

function pngFile(name = 'photo.png', bytes = TINY_PNG): File {
  return new File([bytes], name, { type: 'image/png' })
}

describe('media', () => {
  it('refuses an upload from a signed out visitor', async () => {
    // This refusal is the only thing between the public internet and a client's
    // storage directory.
    const response = await upload(undefined, pngFile())

    expect(response.status).toBe(401)
  })

  it('refuses to list files for a signed out visitor', async () => {
    const response = await api.request('/api/media')

    expect(response.status).toBe(401)
  })

  it('stores an upload and returns it in the contract shape', async () => {
    const cookie = await signIn()
    const response = await upload(cookie, pngFile('holiday.png'))

    expect(response.status).toBe(201)

    const body = mediaUploadResponseSchema.parse(await response.json())
    expect(body.data.file.originalName).toBe('holiday.png')
    expect(body.data.file.contentType).toBe('image/png')
    expect(body.data.file.byteSize).toBe(TINY_PNG.byteLength)
    expect(body.data.file.url).toBe(`/media/${body.data.file.filename}`)
  })

  it('makes the stored bytes reachable through the service the route uses', async () => {
    const cookie = await signIn()
    const created = mediaUploadResponseSchema.parse(
      await (await upload(cookie, pngFile())).json(),
    )

    const served = readMediaFile(created.data.file.filename)

    expect(served).not.toBeNull()
    expect(served?.contentType).toBe('image/png')
    expect(Array.from(served?.bytes ?? [])).toEqual(Array.from(TINY_PNG))
  })

  it('lists what was uploaded', async () => {
    const cookie = await signIn()
    const created = mediaUploadResponseSchema.parse(
      await (await upload(cookie, pngFile())).json(),
    )

    const response = await api.request('/api/media', { headers: { cookie } })
    const body = mediaListResponseSchema.parse(await response.json())

    expect(body.data.files.some(file => file.id === created.data.file.id)).toBe(true)
  })

  it('ignores the filename the browser supplied when building the path on disk', async () => {
    // The stored name is generated from a UUID, so this is what makes traversal
    // impossible rather than merely filtered. The uploaded name is kept for a
    // human to read and never used to build a path.
    const cookie = await signIn()
    const response = await upload(cookie, pngFile('../../../etc/passwd.png'))
    const body = mediaUploadResponseSchema.parse(await response.json())

    expect(body.data.file.filename).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    )
    expect(body.data.file.filename).not.toContain('..')
    expect(body.data.file.originalName).toBe('../../../etc/passwd.png')
  })

  it('rejects a type that is not on the accepted list', async () => {
    const cookie = await signIn()
    const response = await upload(cookie, new File([TINY_PNG], 'notes.txt', { type: 'text/plain' }))

    expect(response.status).toBe(422)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an SVG, which is a document rather than an image', async () => {
    // Kept as a test rather than a comment so that adding image/svg+xml to the
    // accepted list fails here, loudly, with this reason attached.
    const cookie = await signIn()
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'], 'x.svg', {
      type: 'image/svg+xml',
    })

    const response = await upload(cookie, svg)

    expect(response.status).toBe(422)
  })

  it('rejects a file with no bytes', async () => {
    const cookie = await signIn()
    const response = await upload(cookie, pngFile('empty.png', new Uint8Array()))

    expect(response.status).toBe(422)
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

  it('records a known limitation: the declared content type is trusted', async () => {
    /*
     * A file that claims to be a PNG but is not one is accepted today. The
     * mitigation in place is that the serving route sets both an explicit
     * content type and `nosniff`, so a browser will not re-interpret the bytes.
     * Magic byte validation is the real fix, and this test exists so that adding
     * it fails here and forces the comment to be updated rather than quietly
     * leaving a stale note behind.
     */
    const cookie = await signIn()
    const lying = new File(['<html>not a png</html>'], 'evil.png', { type: 'image/png' })

    const response = await upload(cookie, lying)

    expect(response.status).toBe(201)
  })
})
