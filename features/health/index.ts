/**
 * The `health` feature's public boundary.
 *
 * This is the ONLY file other parts of Aika may import from this feature.
 * Deep imports such as `~~/features/health/server/routes` are refused by
 * `npm run arch:check`.
 *
 * NOTE: this is the server / general door. `healthRoutes` reaches
 * `better-sqlite3`, so nothing that runs in a browser may import from here.
 * Browser code uses `~~/features/health/web` instead.
 */
export { healthRoutes } from './server/routes'
export type { HealthResponse } from './contract'
