/**
 * The `health` feature's browser-safe public boundary.
 *
 * A feature has TWO doors, and they are not interchangeable:
 *
 *   index.ts      server / general boundary, may pull in server-only code
 *   web/index.ts  browser-safe boundary, must NEVER pull in server code
 *
 * This split is not ceremony. `index.ts` exports `healthRoutes`, which imports
 * `better-sqlite3`. A Vue component importing from `index.ts` would drag a
 * native Node module into the browser bundle. Importing from `web/` instead
 * makes that mistake impossible, and `npm run arch:check` rule R6 catches it
 * if anyone tries.
 *
 * Types are free: `import type` is erased at build time, so re-exporting a
 * type here costs the browser nothing.
 */
export type { HealthResponse } from '../contract'
