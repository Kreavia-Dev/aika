import { getDb } from '../../../shared/database/client'

/**
 * All SQL for this feature.
 *
 * There is no read function yet, and that is deliberate: this rung adds the
 * endpoint that stores a submission, and the next rung adds the inbox that reads
 * them. A function nothing calls is a function nobody maintains.
 */
export type NewContactMessage = {
  id: string
  name: string
  email: string
  message: string
  userAgent: string | null
  createdAt: string
}

export function insertContactMessage(entry: NewContactMessage): void {
  getDb()
    .prepare(`
      INSERT INTO contact_messages (id, name, email, message, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(entry.id, entry.name, entry.email, entry.message, entry.userAgent, entry.createdAt)
}
