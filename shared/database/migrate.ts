import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from './client'

/**
 * Applying migrations.
 *
 * Kept here, separate from `scripts/migrate.ts`, so the same code runs in the
 * CLI and in the test setup. A test that applies migrations its own way is a
 * test that can pass against a schema nobody deploys.
 *
 * Forward-only, in filename order. Each migration runs inside one transaction
 * together with its bookkeeping row, so a failure leaves no partial record.
 */
const BOOKKEEPING_TABLE = '_aika_migrations'

/** Resolved from this file, not from the caller's working directory. */
export function migrationsDirectory(): string {
  return fileURLToPath(new URL('../../database/migrations', import.meta.url))
}

export function ensureBookkeepingTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${BOOKKEEPING_TABLE} (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export function appliedMigrations(db: Db): Set<string> {
  ensureBookkeepingTable(db)

  const rows = db.prepare(`SELECT name FROM ${BOOKKEEPING_TABLE}`).all() as Array<{ name: string }>
  return new Set(rows.map(row => row.name))
}

export function pendingMigrations(db: Db, directory = migrationsDirectory()): string[] {
  const applied = appliedMigrations(db)

  return readdirSync(directory)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .filter(file => !applied.has(file))
}

/** Applies everything pending and returns the filenames it applied. */
export function applyMigrations(db: Db, directory = migrationsDirectory()): string[] {
  const pending = pendingMigrations(db, directory)
  if (pending.length === 0) return []

  for (const file of pending) {
    const sql = readFileSync(join(directory, file), 'utf8')

    const apply = db.transaction(() => {
      db.exec(sql)
      db.prepare(`INSERT INTO ${BOOKKEEPING_TABLE} (name) VALUES (?)`).run(file)
    })

    apply()
  }

  return pending
}
