import { disableAccount, enableAccount, listAccounts } from '../features/auth'
import { closeDb, getDb } from '../shared/database/client'

/**
 * Account administration from the shell.
 *
 *   npm run user:list
 *   npm run user:disable -- --email=ada@example.com
 *   npm run user:enable  -- --email=ada@example.com
 *
 * WHY THIS IS A CLI AND NOT A WEB SCREEN. Revoking access is something whoever
 * runs the deployment does, and they already have a shell. A web screen would
 * have to decide who is allowed to revoke whom, and today every account is an
 * administrator, so any signed-in user could lock out any other. Rather than
 * build a permission model to answer a question nobody has asked, this stays
 * where the authority already is.
 *
 * The screen for changing your OWN password does exist, at /auth/password. That
 * one has to be in the browser, because the person doing it is the account
 * holder.
 */
function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
}

/**
 * Checked before touching anything, so the operator on a fresh VPS gets a
 * readable instruction instead of `SqliteError: no such table: users`.
 */
function schemaIsReady(): boolean {
  const row = getDb()
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get()

  return row !== undefined
}

function usage(): void {
  console.error('Usage:')
  console.error('  npm run user:list')
  console.error('  npm run user:disable -- --email=<address>')
  console.error('  npm run user:enable  -- --email=<address>')
}

function requireEmail(): string {
  const email = readFlag('email') ?? process.env.AIKA_USER_EMAIL

  if (!email) {
    console.error('Which account? Pass --email=<address>.')
    usage()
    process.exit(1)
  }

  return email
}

function list(): void {
  const accounts = listAccounts()

  if (accounts.length === 0) {
    console.log('No accounts yet. Create the first one with `npm run user:create -- --email=<address>`.')
    return
  }

  console.log(`${accounts.length} account(s):`)
  console.log('')

  for (const account of accounts) {
    const state = account.disabledAt === null
      ? 'active'
      : `disabled since ${account.disabledAt.slice(0, 10)}`

    console.log(`  ${account.email.padEnd(36)} ${account.role.padEnd(7)} ${state}`)
  }

  const active = accounts.filter(account => account.disabledAt === null).length

  if (active === 0) {
    /*
     * Loud on purpose. Nothing stops this state being reached by editing the
     * database by hand, and it is unrecoverable through the web, so the operator
     * needs to know before they discover it at the sign in page.
     */
    console.log('')
    console.log('  WARNING: no active accounts. Nobody can sign in. Re-enable one with `npm run user:enable`.')
  }
}

function disable(): void {
  const account = disableAccount(requireEmail())

  console.log(`${account.email} is disabled as of ${account.disabledAt}.`)
  console.log('Every session it had was ended, so any browser already signed in stops working now.')
}

function enable(): void {
  const account = enableAccount(requireEmail())

  console.log(`${account.email} can sign in again. The password is unchanged, so if the reason for`)
  console.log('disabling was a suspected leak, change it before telling them. That person can now')
  console.log('sign in with whatever password was set before.')
}

const action = process.argv[2]

try {
  if (!schemaIsReady()) {
    console.error('This database has no `users` table yet, so it has not been migrated.')
    console.error('Run `npm run db:migrate` first, then try again.')
    process.exitCode = 1
  }
  else {
    switch (action) {
      case 'list':
        list()
        break
      case 'disable':
        disable()
        break
      case 'enable':
        enable()
        break
      default:
        usage()
        process.exitCode = 1
    }
  }
}
catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
finally {
  // Checkpoints the WAL before exit, so the next reader sees a tidy database.
  closeDb()
}
