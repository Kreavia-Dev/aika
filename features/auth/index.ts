/**
 * The `auth` feature's server boundary.
 *
 * The ONLY file other parts of Aika may import from this feature. Deep imports
 * such as `~~/features/auth/server/service` are refused by `npm run arch:check`.
 *
 * This is the server door. `authRoutes` reaches `better-sqlite3` through the
 * database client, so nothing running in a browser may import from here.
 * Browser code uses `~~/features/auth/web`.
 */
export { authRoutes } from './server/routes'
export { authGuard, currentUser, requireUser } from './server/guard'
export { createUser } from './server/service'
export type { PublicUser, Role } from './contract'
