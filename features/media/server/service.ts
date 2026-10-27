import { randomUUID } from 'node:crypto'
import { env } from '../../../shared/config/env'
import { NotFoundError, ValidationError } from '../../../shared/errors'
import { MAX_UPLOAD_BYTES, extensionFor, type MediaFile } from '../contract'
import {
  deleteMediaFile,
  findMediaByFilename,
  findMediaById,
  findRecentMedia,
  insertMediaFile,
  type MediaFileRow,
} from './repository'
import { fitWithinLimits } from './resize'
import { createLocalMediaStorage, type MediaStorage } from './storage'

/**
 * The media feature's rules.
 *
 * Everything that decides whether an upload is allowed lives here rather than in
 * the route, so the rules can be read and tested without an HTTP request.
 */

/**
 * How many files the library screen shows.
 *
 * A cap rather than paging, because the screen exists so a client can find the
 * picture they uploaded a minute ago. Paging arrives when somebody has enough
 * files that scrolling is the wrong answer, and that is a real requirement
 * rather than a guess.
 */
const MAX_LISTED_FILES = 100

/**
 * How much of the uploaded filename is kept.
 *
 * A filename is attacker controlled text of unbounded length. It is stored, so
 * it is truncated first. This is the same reasoning as MAX_USER_AGENT in the
 * contact feature.
 */
const MAX_ORIGINAL_NAME = 200

/**
 * Built once, from configuration, rather than per request.
 *
 * A second consequence worth stating: this is the only place the feature decides
 * where files live. A test that wants its own directory changes MEDIA_ROOT, not
 * this file.
 */
const storage: MediaStorage = createLocalMediaStorage(env.MEDIA_ROOT)

function toContract(row: MediaFileRow): MediaFile {
  return {
    id: row.id,
    filename: row.filename,
    url: `/media/${row.filename}`,
    originalName: row.original_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  }
}

export type UploadInput = {
  bytes: Uint8Array
  /** The type the browser claimed. Checked against the allowed list. */
  contentType: string | null
  originalName: string | null
  uploadedBy: string | null
}

/**
 * Validate, fit, store the bytes, then record the row.
 *
 * THE ORDER MATTERS AND IS DELIBERATE. The file is written before the row, so a
 * crash between the two leaves a file nobody knows about, which is invisible and
 * harmless. The other order leaves a row pointing at nothing, which renders as a
 * broken image on a client's page. Deleting reverses this, for the same reason.
 */
export async function storeUpload(input: UploadInput): Promise<MediaFile> {
  const contentType = input.contentType ?? ''
  const extension = extensionFor(contentType)

  if (!extension) {
    throw new ValidationError(
      'That kind of file cannot be uploaded.',
      [`contentType: expected one of the accepted image types, received ${contentType || 'nothing'}`],
    )
  }

  if (input.bytes.byteLength === 0) {
    throw new ValidationError('That file is empty.', ['file: the upload had no bytes'])
  }

  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Files must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      [`byteSize: ${input.bytes.byteLength} is over the limit of ${MAX_UPLOAD_BYTES}`],
    )
  }

  /*
   * Fitting also proves the bytes are an image. That check cannot happen any
   * earlier, because before this point all we have is the browser's word for the
   * content type, and a content type is a claim rather than a fact.
   */
  const fitted = await fitWithinLimits(input.bytes, contentType)

  const id = randomUUID()
  /*
   * The name on disk is generated, never taken from the upload. That is what
   * makes path traversal impossible rather than merely filtered, and it also
   * means two people uploading `IMG_0001.jpg` do not collide.
   */
  const filename = `${id}.${extension}`

  storage.put(filename, fitted.bytes)

  const record = {
    id,
    filename,
    originalName: (input.originalName ?? 'unnamed').slice(0, MAX_ORIGINAL_NAME),
    contentType,
    // The size as stored, so the library screen is not lying after a resize.
    byteSize: fitted.bytes.byteLength,
    uploadedBy: input.uploadedBy,
    createdAt: new Date().toISOString(),
  }

  insertMediaFile(record)

  return toContract({
    ...record,
    original_name: record.originalName,
    content_type: record.contentType,
    byte_size: record.byteSize,
    uploaded_by: record.uploadedBy,
    created_at: record.createdAt,
  })
}

export function listMedia(): MediaFile[] {
  return findRecentMedia(MAX_LISTED_FILES).map(toContract)
}

export type ServedFile = {
  bytes: Uint8Array
  contentType: string
}

/**
 * The bytes for one stored file, or null when there is nothing to serve.
 *
 * A missing row and a missing file both return null, because the caller answers
 * the same 404 either way and there is nothing useful to say about which half
 * was missing to somebody who should not have the URL.
 */
export function readMediaFile(filename: string): ServedFile | null {
  const row = findMediaByFilename(filename)
  if (!row) return null

  const bytes = storage.read(row.filename)
  if (!bytes) return null

  return { bytes, contentType: row.content_type }
}

/**
 * Forget a file, and then remove its bytes.
 *
 * THE ORDER IS THE REVERSE OF storeUpload, ON PURPOSE. The row goes first, so a
 * failure between the two steps leaves a file on disk that nothing points at.
 * That file is invisible, costs a little disk, and can be swept up later. The
 * other order leaves a row pointing at nothing, which is a broken image on a
 * page a client is showing somebody.
 *
 * The row is also what makes the file addressable, so removing it first means
 * the URL stops working at the moment the decision was made, rather than after
 * the slower of the two steps.
 */
export function removeMedia(id: string): MediaFile {
  const row = findMediaById(id)

  if (!row) {
    throw new NotFoundError('That file is not in the library.')
  }

  deleteMediaFile(id)
  storage.remove(row.filename)

  return toContract(row)
}
