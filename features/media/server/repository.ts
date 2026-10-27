import { getDb } from '../../../shared/database/client'

/**
 * All SQL for the media feature.
 *
 * Rows are snake_case because that is what SQLite holds. Nothing outside this
 * file sees one: the service turns them into the contract's camelCase shape.
 */

export type NewMediaFile = {
  id: string
  filename: string
  originalName: string
  contentType: string
  byteSize: number
  uploadedBy: string | null
  createdAt: string
}

export type MediaFileRow = {
  id: string
  filename: string
  original_name: string
  content_type: string
  byte_size: number
  uploaded_by: string | null
  created_at: string
}

export function insertMediaFile(file: NewMediaFile): void {
  getDb()
    .prepare(`
      INSERT INTO media_files
        (id, filename, original_name, content_type, byte_size, uploaded_by, created_at)
      VALUES
        (@id, @filename, @originalName, @contentType, @byteSize, @uploadedBy, @createdAt)
    `)
    .run(file)
}

export function findMediaByFilename(filename: string): MediaFileRow | undefined {
  return getDb()
    .prepare('SELECT * FROM media_files WHERE filename = ?')
    .get(filename) as MediaFileRow | undefined
}

export function findMediaById(id: string): MediaFileRow | undefined {
  return getDb()
    .prepare('SELECT * FROM media_files WHERE id = ?')
    .get(id) as MediaFileRow | undefined
}

/**
 * Remove the row. The bytes on disk are the caller's problem, on purpose.
 *
 * This file owns SQL and nothing else, and deleting a file is not SQL.
 */
export function deleteMediaFile(id: string): void {
  getDb().prepare('DELETE FROM media_files WHERE id = ?').run(id)
}

/**
 * The newest files first, capped.
 *
 * No index on `created_at`, for the reason recorded in 0005_media.sql: the table
 * stays small enough that a scan is the honest implementation, and an index
 * nobody measured is a maintenance cost paid for nothing.
 */
export function findRecentMedia(limit: number): MediaFileRow[] {
  return getDb()
    .prepare('SELECT * FROM media_files ORDER BY created_at DESC LIMIT ?')
    .all(limit) as MediaFileRow[]
}
