import { getDb } from '../../../shared/database/client'

/** All SQL for this feature. */
export type NewContactMessage = {
  id: string
  name: string
  email: string
  message: string
  userAgent: string | null
  createdAt: string
}

/** A row exactly as SQLite returns it, snake_case included. */
export type ContactMessageRow = {
  id: string
  name: string
  email: string
  message: string
  user_agent: string | null
  created_at: string
}

export function insertContactMessage(entry: NewContactMessage): void {
  getDb()
    .prepare(`
      INSERT INTO contact_messages (id, name, email, message, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(entry.id, entry.name, entry.email, entry.message, entry.userAgent, entry.createdAt)
}

/**
 * Newest first, with a hard limit.
 *
 * The limit is not optional. A read on a table that only ever grows is the kind
 * of thing that works for a year and then stops working, and the inbox has no
 * pagination yet, so the cap is what keeps the response bounded.
 *
 * There is deliberately no index on `created_at`. An index costs a write on every
 * insert, and sorting a few hundred rows in SQLite is not measurable. Add one when
 * a real client's table is large enough to notice, and measure before adding it,
 * because an index that is there "just in case" is a permanent cost paid for a
 * problem that may never arrive.
 */
export function findRecentMessages(limit: number): ContactMessageRow[] {
  return getDb()
    .prepare(`
      SELECT id, name, email, message, user_agent, created_at
      FROM contact_messages
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `)
    .all(limit) as ContactMessageRow[]
}
