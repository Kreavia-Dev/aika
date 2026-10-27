/**
 * The `contact` feature's server boundary.
 *
 * The ONLY file other parts of Aika may import from this feature. Deep imports
 * such as `~~/features/contact/server/service` are refused by `npm run arch:check`.
 *
 * This is the server door. `contactRoutes` reaches `better-sqlite3` through the
 * database client, so nothing running in a browser may import from here. Browser
 * code uses `~~/features/contact/web`.
 */
export { contactRoutes } from './server/routes'
export type { ContactInput, ContactResponse } from './contract'
