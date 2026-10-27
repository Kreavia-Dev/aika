/**
 * The media feature's browser door.
 *
 * Types only, and nothing else.
 *
 * Rule R6 refuses `node:*`, `better-sqlite3`, `shared/database` and anything
 * under `server/` in this directory, because all of it would be bundled and sent
 * to the browser. Keeping this file to type re-exports means the rule cannot be
 * tripped by accident. The constants the browser genuinely needs, like the
 * upload size limit, live in `../contract` and are imported from there.
 */
export type { MediaFile, MediaUploadResponse, MediaListResponse } from '../contract'
