import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { env } from '../../shared/config/env'
import { getDb } from '../../shared/database/client'
import { applyMigrations } from '../../shared/database/migrate'

/**
 * Runs before every test file.
 *
 * The suite runs against `database/test.db`, set in `vitest.config.ts`, never
 * against the development database. This brings that file up to the same schema
 * the deploy uses, through the same `applyMigrations` the CLI calls, so a test
 * can never pass against a schema nobody ships.
 */
const db = getDb()

applyMigrations(db)

/**
 * Empty every table the application owns.
 *
 * Discovered rather than listed, so adding a feature does not mean remembering
 * to come back here and a forgotten table cannot leak state into the next run.
 * `_aika_migrations` is excluded because the schema depends on it, and `sqlite_`
 * tables are SQLite's own.
 *
 * The table name is interpolated because a name cannot be a bound parameter, and
 * it comes from `sqlite_master`, not from anything a caller controls.
 */
const ownedTables = db
  .prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_aika_migrations'
  `)
  .all() as Array<{ name: string }>

for (const table of ownedTables) {
  db.exec(`DELETE FROM "${table.name}"`)
}

/**
 * Empty the directory uploaded files are written to.
 *
 * WHY THIS IS NEEDED AT ALL. Everything above deletes rows, and rows are not
 * files. A media test writes a real file, so without this the next run starts
 * with the previous run's leftovers in the storage directory, and a test that
 * counts files would pass or fail depending on how many times it had been run.
 *
 * WHY IT REFUSES TO RUN ANYWHERE ELSE. This deletes a directory recursively. The
 * only thing standing between a mistyped MEDIA_ROOT and a developer's uploaded
 * files is the comparison below, so it fails loudly rather than emptying
 * whatever it was pointed at.
 */
const mediaRoot = resolve(env.MEDIA_ROOT)
const suiteMediaRoot = resolve('./storage/test-media')

if (mediaRoot !== suiteMediaRoot) {
  throw new Error(
    `Refusing to empty "${mediaRoot}". The test suite may only clear its own media directory, "${suiteMediaRoot}". Check MEDIA_ROOT in vitest.config.ts.`,
  )
}

rmSync(mediaRoot, { recursive: true, force: true })
