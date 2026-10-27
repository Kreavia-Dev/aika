/**
 * PM2 process definition for Aika client deployments.
 *
 * exec_mode is `fork` with a single instance ON PURPOSE.
 * `cluster` mode would start N worker processes, each holding its own
 * SQLite connection. SQLite serialises writes at the file level, so extra
 * writers buy no throughput and only introduce SQLITE_BUSY variance.
 * Scale vertically. See docs/aika/ARCHITECTURE.md ("SQLite in production").
 *
 * WHY `cwd` IS SPELLED OUT RATHER THAN LEFT TO PM2. PM2 otherwise inherits the
 * directory `pm2 start` happened to run from, and every relative path below
 * depends on it: `script`, and the database default if the env file is not
 * found. A process restarted from a different directory would quietly open a
 * brand new empty database somewhere else and still report its health as up.
 *
 * WHY `NODE_ENV` IS SET HERE AND ALSO IN THE ENV FILE. `--env-file-if-exists`
 * does not fail when the file is missing, so a wrong path would otherwise start
 * the process in development mode: the https guard in shared/config/env.ts is
 * skipped, `secure` is dropped from the session cookie, and the empty APP_URL
 * default is accepted on a production domain. Setting it here means a missing
 * env file runs into that https guard instead, which is loud rather than silent.
 *
 * WHY THE LOGS ARE ABSOLUTE. Relative log paths land wherever PM2 was started
 * from, which is the same class of surprise as the database path above.
 */
module.exports = {
  apps: [
    {
      name: 'aika',
      cwd: '/srv/aika/app',
      script: '.output/server/index.mjs',

      // Absolute, and outside the application directory, so it survives a
      // redeploy and never sits inside a tree that a sync or a static handler
      // could reach. Node accepts the flag more than once, applied in order, so
      // a local `.env` still works for somebody running this by hand.
      node_args: '--env-file-if-exists=/etc/aika/env --env-file-if-exists=.env',

      env: {
        NODE_ENV: 'production',
      },

      exec_mode: 'fork',
      instances: 1,

      // PM2's first signal is SIGINT. Give the process time to drain.
      //
      // NOTE, and this is a known gap rather than a claim: this does NOT
      // currently checkpoint the database, because nothing subscribes to the
      // runtime's shutdown hook. write-ahead-log content is replayed on next
      // open, so no data is lost, but the `.wal` file is not truncated on exit.
      kill_timeout: 5000,

      max_memory_restart: '512M',
      autorestart: true,

      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/srv/aika/logs/error.log',
      out_file: '/srv/aika/logs/out.log',
    },
  ],
}