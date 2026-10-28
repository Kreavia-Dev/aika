/**
 * The `auth` feature's server boundary.
 *
 * The ONLY file other parts of Aika may import from this feature. Deep imports
 * such as `~~/features/auth/server/service` are refused by `npm run arch:check`.
 *
 * This is the server door. `authRoutes` reaches `better-sqlite3` through the
 * database client, so nothing running in a browser may import from here. Browser
 * code uses `~~/features/auth/web`.
 */
export { authRoutes } from './server/routes'
export {
  atLeast,
  authGuard,
  currentUser,
  requireAtLeast,
  requireRole,
  requireUser,
  roleGuard,
} from './server/guard'
export {
  changePassword,
  changeRole,
  createUser,
  disableAccount,
  enableAccount,
  listAccounts,
  resetPassword,
} from './server/service'
export { generatePassword } from './server/password'
export type { AccountRow, ChangePasswordResult, SessionDetail } from './server/service'
export type { Account, PublicUser, Role } from './contract'
