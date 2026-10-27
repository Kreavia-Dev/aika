import { getDb } from '../../shared/database/client'
import { applyMigrations } from '../../shared/database/migrate'

/**
 * Runs before every test file.
 *
 * The suite runs against `database/test.db`, set in `vitest.config.ts`, never
 * against the development database. This brings that file up to the same schema
 * the deploy uses, through the same `applyMigrations` the CLI calls, so a test
 * can never pass against a schema nobody ships.
 *
 * Rows are cleared afterwards so a file starts from a known state. Tests within
 * one file still share a database, so they create their own users under distinct
 * emails rather than assuming an empty table.
 */
const db = getDb()

applyMigrations(db)

db.exec('DELETE FROM sessions')
db.exec('DELETE FROM users')
