import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from '../shared/database/client'

/**
 * Online SQLite backup using better-sqlite3's `.backup()`.
 *
 * This is safe to run while the application is serving traffic, it does not
 * copy the file, and it does not need the app stopped. Do NOT replace this
 * with `cp` on a WAL-mode database: you would capture a torn state.
 *
 * Retention keeps the newest N snapshots. Set `AIKA_BACKUP_KEEP` to change it.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backupsDir = join(root, 'database', 'backups')
const keep = Number(process.env.AIKA_BACKUP_KEEP ?? 14)

mkdirSync(backupsDir, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const target = join(backupsDir, `aika-${stamp}.db`)

const db = getDb()
await db.backup(target)
closeDb()

console.log(`Backup written: ${target}`)

const existing = readdirSync(backupsDir)
  .filter(file => file.endsWith('.db'))
  .map(file => ({ file, time: statSync(join(backupsDir, file)).mtimeMs }))
  .sort((a, b) => b.time - a.time)

for (const stale of existing.slice(keep)) {
  unlinkSync(join(backupsDir, stale.file))
  console.log(`Pruned: ${stale.file}`)
}

console.log(`Kept ${Math.min(existing.length, keep)} snapshot(s).`)
