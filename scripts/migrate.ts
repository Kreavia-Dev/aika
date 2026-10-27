import { mkdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { closeDb, getDb } from '../shared/database/client'
import { applyMigrations, migrationsDirectory, pendingMigrations } from '../shared/database/migrate'

/**
 * Applies `database/migrations/*.sql` in filename order.
 *
 * The applying itself lives in `shared/database/migrate.ts` so the test setup
 * can run exactly the same code. What lives here is the deploy ceremony:
 *
 *   A snapshot is taken first whenever there is something to apply. A migration
 *   that runs against an unbacked-up database is a migration you cannot undo.
 */
const migrationDirectory = migrationsDirectory()
const backupsDirectory = resolve(migrationDirectory, '..', 'backups')

const db = getDb()
const pending = pendingMigrations(db, migrationDirectory)

if (pending.length === 0) {
  console.log('Database is up to date. Nothing to apply.')
  closeDb()
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const snapshot = join(backupsDirectory, `pre-migrate-${stamp}.db`)

mkdirSync(backupsDirectory, { recursive: true })

try {
  await db.backup(snapshot)
  console.log(`Snapshot written: ${relative(resolve(migrationDirectory, '..', '..'), snapshot)}`)
}
catch (error) {
  console.error('Refusing to migrate: could not write a snapshot first.')
  console.error(error)
  closeDb()
  process.exit(1)
}

try {
  const applied = applyMigrations(db, migrationDirectory)

  for (const file of applied) {
    console.log(`applied  ${file}`)
  }

  console.log(`\n${applied.length} migration(s) applied.`)
}
catch (error) {
  console.error('Migration failed.')
  console.error(error)
  console.error(`\nRestore with:\n  cp "${snapshot}" "${resolve(process.env.DATABASE_PATH ?? './database/aika.db')}"`)
  process.exitCode = 1
}
finally {
  closeDb()
}
