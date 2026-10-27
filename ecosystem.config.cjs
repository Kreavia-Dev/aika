/**
 * PM2 process definition for Aika client deployments.
 *
 * exec_mode is `fork` with a single instance ON PURPOSE.
 * `cluster` mode would start N worker processes, each holding its own
 * SQLite connection. SQLite serialises writes at the file level, so extra
 * writers buy no throughput and only introduce SQLITE_BUSY variance.
 * Scale vertically. See ARCHITECTURE.md ("SQLite in production").
 */
module.exports = {
  apps: [
    {
      name: 'aika',
      script: '.output/server/index.mjs',
      node_args: '--env-file-if-exists=.env',

      exec_mode: 'fork',
      instances: 1,

      // PM2's first signal is SIGINT. Give the process time to close the
      // database cleanly so the WAL checkpoints instead of being replayed.
      kill_timeout: 5000,

      max_memory_restart: '512M',
      autorestart: true,

      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
    },
  ],
}
