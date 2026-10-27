import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { env } from '../config/env'

export type Db = Database.Database

let instance: Db | null = null

/**
 * The only place a SQLite connection is opened in Aika.
 *
 * No feature may call `new Database(...)` itself. One connection, one set of
 * pragmas, applied in one place. `scripts/check-boundaries.ts` enforces this.
 */
export function getDb(): Db {
  if (instance) return instance

  const path = resolve(env.DATABASE_PATH)
  mkdirSync(dirname(path), { recursive: true })

  const db = new Database(path)

  // Order matters: WAL is persistent once set, but the rest apply per connection.
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('wal_autocheckpoint = 1000')

  instance = db
  return db
}

/** Cheap liveness probe for health checks. Never throws. */
export function pingDatabase(): boolean {
  try {
    getDb().prepare('SELECT 1 AS ok').get()
    return true
  }
  catch {
    return false
  }
}

/** Called on shutdown so the WAL checkpoints cleanly before exit. */
export function closeDb(): void {
  if (!instance) return
  try {
    instance.pragma('wal_checkpoint(TRUNCATE)')
    instance.close()
  }
  finally {
    instance = null
  }
}
