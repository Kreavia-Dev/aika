import { randomBytes } from 'node:crypto'
import { createUser } from '../features/auth'
import { closeDb, getDb } from '../shared/database/client'

/**
 * Creates a user.
 *
 * There is no sign-up screen, on purpose. A client site has a handful of staff
 * accounts created by whoever runs the deployment, not open registration.
 *
 *   npm run user:create -- --email ada@example.com
 *   npm run user:create -- --email ada@example.com --role=editor
 *
 * A password is generated and printed once. `--password` is accepted for
 * scripted setup, and it ends up in your shell history, so prefer the generated
 * one. There is no change-password flow yet, so write it down.
 */
const GENERATED_PASSWORD_BYTES = 18

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.find(argument => argument.startsWith(prefix))
  return match?.slice(prefix.length)
}

function generatePassword(): string {
  return randomBytes(GENERATED_PASSWORD_BYTES).toString('base64url')
}

/**
 * Checked before creating anything, so the operator on a fresh VPS gets a
 * readable instruction instead of `SqliteError: no such table: users`.
 * The first thing anyone does on a new deployment is run this script, and
 * forgetting the migration is the likeliest way to arrive here.
 */
function schemaIsReady(): boolean {
  const row = getDb()
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get()

  return row !== undefined
}

function usage(): void {
  console.error('Usage: npm run user:create -- --email=<address> [--role=admin|editor] [--password=<value>]')
}

async function main(): Promise<void> {
  const email = readFlag('email') ?? process.env.AIKA_USER_EMAIL
  const role = readFlag('role')
  const suppliedPassword = readFlag('password')

  if (!email) {
    usage()
    process.exitCode = 1
    return
  }

  if (role !== undefined && role !== 'admin' && role !== 'editor') {
    console.error(`Unknown role "${role}". Use admin or editor.`)
    process.exitCode = 1
    return
  }

  if (!schemaIsReady()) {
    console.error('This database has no `users` table yet, so it has not been migrated.')
    console.error('Run `npm run db:migrate` first, then try again.')
    process.exitCode = 1
    return
  }

  const password = suppliedPassword ?? generatePassword()

  const user = await createUser({
    email,
    password,
    role: role === 'editor' ? 'editor' : 'admin',
  })

  console.log(`Created ${user.email} with role ${user.role}.`)

  if (suppliedPassword === undefined) {
    console.log('')
    console.log(`  Password: ${password}`)
    console.log('')
    console.log('Shown once. There is no change-password flow yet, so save it now.')
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    // Checkpoints the WAL before exit, so the next reader sees a tidy database.
    closeDb()
  })
