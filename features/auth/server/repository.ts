import { getDb } from '../../../shared/database/client'
import type { Role } from '../contract'

/**
 * All SQL for this feature.
 *
 * Nothing here hashes, validates, or decides anything. It reads and writes
 * rows, and the service does the thinking. `shared/database/client` is the only
 * place SQLite is opened in Aika, and `arch:check` refuses a feature that tries
 * to open its own connection.
 */
export type UserRow = {
  id: string
  email: string
  password_hash: string
  role: Role
  created_at: string
}

export type SessionRow = {
  id: string
  user_id: string
  created_at: string
  expires_at: string
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare('SELECT id, email, password_hash, role, created_at FROM users WHERE email = ?')
    .get(email) as UserRow | undefined
}

export function findUserById(id: string): UserRow | undefined {
  return getDb()
    .prepare('SELECT id, email, password_hash, role, created_at FROM users WHERE id = ?')
    .get(id) as UserRow | undefined
}

export function insertUser(user: {
  id: string
  email: string
  passwordHash: string
  role: Role
  createdAt: string
}): void {
  getDb()
    .prepare('INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, user.email, user.passwordHash, user.role, user.createdAt)
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number }
  return row.total
}

export function insertSession(session: SessionRow): void {
  getDb()
    .prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(session.id, session.user_id, session.created_at, session.expires_at)
}

export function findSessionById(id: string): SessionRow | undefined {
  return getDb()
    .prepare('SELECT id, user_id, created_at, expires_at FROM sessions WHERE id = ?')
    .get(id) as SessionRow | undefined
}

export function deleteSessionById(id: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

/**
 * Housekeeping. Expired rows are not a security problem, because every lookup
 * checks `expires_at`, but they accumulate. Login is a convenient moment to
 * sweep them: it is rare enough to be cheap and frequent enough to keep up.
 */
export function deleteExpiredSessions(now: string): number {
  const result = getDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
  return result.changes
}
