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
  /** Null while the account is active. Set when access is revoked. */
  disabled_at: string | null
}

export type SessionRow = {
  id: string
  user_id: string
  created_at: string
  expires_at: string
}

const USER_COLUMNS = 'id, email, password_hash, role, created_at, disabled_at'

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`)
    .get(email) as UserRow | undefined
}

export function findUserById(id: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined
}

export function listUsers(): UserRow[] {
  return getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at`)
    .all() as UserRow[]
}

/**
 * Active accounts only.
 *
 * Disabling is refused when this would reach zero, so it is the count that
 * decides whether a revocation is allowed, not the total.
 */
export function countActiveUsers(): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM users WHERE disabled_at IS NULL')
    .get() as { total: number }

  return row.total
}

/**
 * Active administrators only, which is the count that actually matters.
 *
 * Active accounts are not enough: an editor cannot administer anything, so a
 * deployment whose only remaining active account is an editor still needs the
 * shell to recover. Disabling and demoting are both refused when this reaches
 * one and the account in question is the one holding it.
 */
export function countActiveAdmins(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM users WHERE disabled_at IS NULL AND role = 'admin'`)
    .get() as { total: number }

  return row.total
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number }
  return row.total
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

export function updateUserPassword(id: string, passwordHash: string): void {
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

export function setUserDisabledAt(id: string, disabledAt: string | null): void {
  getDb().prepare('UPDATE users SET disabled_at = ? WHERE id = ?').run(disabledAt, id)
}

export function setUserRole(id: string, role: Role): void {
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
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
 * Ends a user's sessions, optionally sparing one.
 *
 * Sparing the current session is what makes changing a password usable: the user
 * is signed out everywhere else and not from the tab they are sitting in.
 */
export function deleteUserSessions(userId: string, exceptSessionId?: string): number {
  if (exceptSessionId === undefined) {
    return getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes
  }

  return getDb()
    .prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
    .run(userId, exceptSessionId).changes
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
