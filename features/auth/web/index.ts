/**
 * The `auth` feature's browser-safe boundary.
 *
 * Types only, and deliberately so. This file is imported by Vue components, so
 * anything value-shaped here would be pulled into the client bundle. Types cost
 * the browser nothing: `import type` is erased at build time.
 *
 * See docs/aika/ARCHITECTURE.md for why a feature has two doors instead of one.
 */
export type { LogoutResponse, PublicUser, Role, SessionResponse } from '../contract'
