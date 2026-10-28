import { generatePassword, resetPassword } from '../features/auth'
import { closeDb, getDb } from '../shared/database/client'

/**
 * Replaces an account's password, for when nobody knows it.
 *
 *   npm run user:password -- --email=ada@example.com
 *
 * WHY THIS IS A SHELL COMMAND. Changing your own password is a web screen, and
 * that screen requires the current password, which is no help when the current
 * password is the thing that was lost. Whoever runs the deployment already has a
 * shell, and this is the one operation where that shell is the only way back in.
 *
 * WHY IT DOES NOT TAKE A PASSWORD ARGUMENT. A password typed as a flag lands in
 * shell history and in the process list, where every other user on the machine
 * can read it. The generated one is printed once instead, and printed passwords
 * are a thing people copy rather than invent.
 *
 * WHAT IT DOES BESIDES SETTING THE PASSWORD. It ends every session the account
 * holds, including one that is open right now. A reset that leaves a signed-in
 * browser working has not reset anything, and the usual reason to run this is
 * that somebody noticed such a browser.
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
  console.error('Usage: npm run user:password -- --email=<address>')
  console.error('')
  console.error('The password is generated and printed once. It cannot be shown again.')
}

async function main(): Promise<void> {
  if (!schemaIsReady()) {
    console.error('This database has no `users` table yet, so it has not been migrated.')
    console.error('Run `npm run db:migrate` first, then try again.')
    process.exitCode = 1
    return
  }

  const email = readFlag('email') ?? process.env.AIKA_USER_EMAIL

  if (!email) {
    usage()
    process.exitCode = 1
    return
  }

  /*
   * Refused before anything is written. `--password` is not accepted at all, and
   * silently ignoring it would let somebody believe they set a password they did
   * not set, which is the sort of mistake that is discovered at the sign in page
   * an hour later.
   */
  if (readFlag('password') !== undefined) {
    console.error('This command does not accept --password, because a password in a command line')
    console.error('lands in your shell history and in the process list.')
    console.error('')
    console.error('Run it without --password to get one generated, then change it at')
    console.error('/auth/password after signing in if you want something memorable.')
    process.exitCode = 1
    return
  }

  const password = generatePassword()
  const { account, sessionsEnded } = await resetPassword({ email, password })

  console.log(`Password for ${account.email} (${account.role}) has been replaced.`)
  console.log('')
  console.log(`  Password: ${password}`)
  console.log('')
  console.log('Shown once. There is no way to read it back.')

  /*
   * Spelled out rather than implied. An operator who resets a password and then
   * hears that the person is "suddenly signed out" should already know why, and
   * a zero is worth seeing too: it means nobody was holding a session.
   */
  console.log('')
  console.log(sessionsEnded === 0
    ? 'No session was open for that account, so nothing was signed out.'
    : `Every session for that account was ended, ${sessionsEnded} in total. Any browser holding one stops working now.`)

  if (account.disabledAt !== null) {
    console.log('')
    console.log(`  NOTE: this account is disabled, so the new password will not work until you run`)
    console.log(`  npm run user:enable -- --email=${account.email}`)
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
