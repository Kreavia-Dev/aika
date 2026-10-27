/**
 * The media feature's server door.
 *
 * Anything outside this feature imports from here and nowhere deeper. See rule
 * R2 in AGENTS.md, and the note in the auth feature's door about why the list of
 * exports is explicit rather than a wildcard.
 */
export { mediaRoutes } from './server/routes'
export { readMediaFile } from './server/service'
export type { MediaFile, MediaUploadResponse, MediaListResponse } from './contract'
