import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from '../shared/database/client'

/**
 * Applies `database/migrations/*.sql` in filename order.
 *
 * Migrations are forward-only and each runs inside a transaction together
 * with its bookkeeping row, so a failed migration leaves no partial record.
 *
 * A snapshot of the database is taken first whenever there is something to
 * apply. A migration that runs against an unbacked-up database is a
 * migration you cannot undo.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'database', 'migrations')
const backupsDir = join(root, 'database', 'backups')

const db = getDb()

db.exec(`
  CREATE TABLE IF NOT EXISTS _aika_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

const rows = db
  .prepare('SELECT name FROM _aika_migrations')
  .all() as Array<{ name: string }>

const applied = new Set(rows.map(row => row.name))

const pending = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort()
  .filter(file => !applied.has(file))

if (pending.length === 0) {
  console.log('Database is up to date. Nothing to apply.')
  closeDb()
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const snapshot = join(backupsDir, `pre-migrate-${stamp}.db`)

mkdirSync(backupsDir, { recursive: true })

try {
  await db.backup(snapshot)
  console.log(`Snapshot written: ${relative(root, snapshot)}`)
}
catch (error) {
  console.error('Refusing to migrate: could not write a snapshot first.')
  console.error(error)
  closeDb()
  process.exit(1)
}

for (const file of pending) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8')

  const apply = db.transaction(() => {
    db.exec(sql)
    db.prepare('INSERT INTO _aika_migrations (name) VALUES (?)').run(file)
  })

  try {
    apply()
    console.log(`applied  ${file}`)
  }
  catch (error) {
    console.error(`failed   ${file}`)
    console.error(error)
    console.error(`\nRestore with:\n  cp "${snapshot}" "${resolve(root, process.env.DATABASE_PATH ?? './database/aika.db')}"`)
    closeDb()
    process.exit(1)
  }
}

console.log(`\n${pending.length} migration(s) applied.`)
closeDb()
