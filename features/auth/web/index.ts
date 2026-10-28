/**
 * The `auth` feature's browser-safe boundary.
 *
 * Types, plus one small function, and the exception is deliberate.
 *
 * The rule is that anything value-shaped here is pulled into the client bundle, so
 * values cost the browser something and types cost nothing. `carriesAtLeast` is
 * the exception because the browser genuinely has to make the same decision the
 * server does: a page that is administrator only must decide whether to show
 * itself, and a second copy of "admin is above editor" would eventually disagree
 * with the guard that enforces it. It is two comparisons and a throw, it imports
 * nothing, and it drags in no native module, which is what R6 actually protects.
 *
 * See docs/aika/ARCHITECTURE.md for why a feature has two doors instead of one.
 */
export type { LogoutResponse, PublicUser, Role, SessionResponse } from '../contract'
export { carriesAtLeast } from '../contract'
