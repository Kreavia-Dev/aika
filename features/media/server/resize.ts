import sharp from 'sharp'
import { ValidationError } from '../../../shared/errors'
import { MAX_IMAGE_DIMENSION } from '../contract'

/**
 * Fitting an upload to the size a website actually needs.
 *
 * WHY THIS EXISTS AT ALL. Without it, a photo from a phone arrives at four or
 * five megabytes and four thousand pixels wide, and it is served that way to
 * every visitor on every page that shows it. Resizing is the difference between
 * an image feature and a slow site.
 *
 * This file also answers a second question the rest of the feature cannot: are
 * these bytes actually an image? Before it, all anybody has is the content type
 * the browser claimed, and a content type is a claim rather than a fact.
 */

export type FittedImage = {
  bytes: Uint8Array
  /** Whether the bytes changed. Recorded so the recorded size stays honest. */
  resized: boolean
}

/**
 * Types that are validated but never re-encoded.
 *
 * GIF is here because sharp reads the FIRST FRAME of an animated GIF and would
 * write back a still image. That is not a resize, it is data loss, and it would
 * happen silently. A GIF is therefore stored as uploaded, oversized and all.
 *
 * Note that this skips the resize and not the check. Validating first matters,
 * because otherwise `image/gif` would become the one content type that lets
 * arbitrary bytes through, which is exactly the hole validation exists to close.
 */
const DO_NOT_RESIZE = new Set(['image/gif'])

/**
 * Shrink to fit, or hand back exactly what came in.
 *
 * TWO DECISIONS WORTH READING BEFORE CHANGING ANYTHING HERE.
 *
 * First, an image already inside the limit is returned byte for byte, not
 * re-encoded. Re-encoding a JPEG that was already the right size would lose a
 * little quality every time somebody uploaded it, for no benefit at all.
 *
 * Second, `rotate()` before the resize. A photo from a phone usually carries its
 * orientation in EXIF rather than in its pixels, and sharp drops that metadata
 * on the way out. Without this, portrait photos are stored and served sideways.
 * Rotating first bakes the orientation into the pixels, which is the only
 * version that survives being copied around the web.
 */
export async function fitWithinLimits(bytes: Uint8Array, contentType: string): Promise<FittedImage> {
  let width = 0
  let height = 0

  try {
    const metadata = await sharp(bytes).metadata()
    width = metadata.width ?? 0
    height = metadata.height ?? 0
  } catch {
    throw new ValidationError(
      'That file could not be read as an image.',
      [`file: the bytes are not a readable image, whatever the upload claimed (${contentType})`],
    )
  }

  if (width === 0 || height === 0) {
    throw new ValidationError(
      'That file could not be read as an image.',
      ['file: the image reported no dimensions'],
    )
  }

  if (DO_NOT_RESIZE.has(contentType)) {
    return { bytes, resized: false }
  }

  if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
    return { bytes, resized: false }
  }

  const output = await sharp(bytes)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      // `inside` keeps the aspect ratio and treats the two numbers as a box.
      fit: 'inside',
      // An image smaller than the box is not stretched to fill it.
      withoutEnlargement: true,
    })
    .toBuffer()

  return { bytes: new Uint8Array(output), resized: true }
}
