/**
 * The `contact` feature's browser-safe boundary.
 *
 * Types only, deliberately. The public form lives in `app/components/` because it
 * belongs to the client, and the reasoning is in `contract.ts`.
 *
 * Why a browser door exists at all for a feature whose UI is mostly elsewhere:
 * the server door at `~~/features/contact` exports `contactRoutes`, which reaches
 * `better-sqlite3` through the database client. A Vue component importing from
 * there would drag SQLite into the browser bundle, and rule R6 in
 * `npm run arch:check` refuses it. This file has no imports at all, so it is safe
 * to import from anywhere, including a component.
 */
export type {
  ContactInput,
  ContactMessage,
  ContactMessagesResponse,
  ContactResponse,
} from '../contract'
