import { z } from 'zod'

/**
 * The media feature's public promise.
 *
 * Written before the implementation on purpose. The server and the browser both
 * read this file, so it may not import anything that only exists on one side.
 */

/**
 * The largest upload Aika will accept, in bytes. Five megabytes.
 *
 * WHY THIS NUMBER, AND WHY THE BROWSER IS TOLD IT. A phone photo is routinely
 * three to five megabytes, and the point of this limit is to refuse the two
 * hundred megabyte file that somebody drags in by mistake, not to be frugal.
 * The browser is told the number so it can refuse instantly instead of
 * uploading for a minute and then being told no. That is why it lives here
 * rather than in the service: this constant is deliberately shared.
 *
 * The server enforces it too. A client side check is a convenience, never a
 * control.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * The longest edge an image is stored at, in pixels. Anything larger is shrunk
 * to fit before it is written.
 *
 * Shared with the browser so the library screen can tell the truth about what
 * happens to an upload. 1920 because that is the width of a typical desktop
 * viewport at a common pixel density, and a client site does not benefit from
 * anything wider being served to a phone.
 */
export const MAX_IMAGE_DIMENSION = 1920

/**
 * The image types Aika accepts.
 *
 * WHY SVG IS NOT ON THIS LIST, AND SHOULD NOT BE ADDED CASUALLY. An SVG is not
 * an image format, it is a document that can carry `<script>`. Served from the
 * site's own origin, it runs in the site's own origin, which makes it a stored
 * cross site scripting vector rather than a picture. If a client ever needs SVG
 * uploads, the file has to be served from a different origin or with a forced
 * download disposition, and that is a decision rather than a list entry.
 *
 * Each entry carries its own extension. The stored filename ends in it, because
 * a URL without an extension is served correctly but cached badly by proxies
 * that decide by suffix.
 */
export const ALLOWED_IMAGE_TYPES = [
  { contentType: 'image/jpeg', extension: 'jpg' },
  { contentType: 'image/png', extension: 'png' },
  { contentType: 'image/webp', extension: 'webp' },
  { contentType: 'image/gif', extension: 'gif' },
] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]['contentType']

export function extensionFor(contentType: string): string | null {
  return ALLOWED_IMAGE_TYPES.find(entry => entry.contentType === contentType)?.extension ?? null
}

export const mediaFileSchema = z.object({
  id: z.string(),
  /** The generated name on disk, also the last segment of `url`. */
  filename: z.string(),
  /** Where the browser fetches it. Absolute, because that is what an `img` needs. */
  url: z.string(),
  /** What the uploader called it, kept only so a human can recognise it. */
  originalName: z.string(),
  contentType: z.string(),
  /** The size as stored, after any resizing, not the size that was uploaded. */
  byteSize: z.number().int().nonnegative(),
  uploadedBy: z.string().nullable(),
  createdAt: z.string(),
})

export type MediaFile = z.infer<typeof mediaFileSchema>

export const mediaUploadResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ file: mediaFileSchema }),
})

export type MediaUploadResponse = z.infer<typeof mediaUploadResponseSchema>

export const mediaListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ files: z.array(mediaFileSchema) }),
})

export type MediaListResponse = z.infer<typeof mediaListResponseSchema>

export const mediaDeleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ id: z.string() }),
})

export type MediaDeleteResponse = z.infer<typeof mediaDeleteResponseSchema>
