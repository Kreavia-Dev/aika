# Changelog

**English** · [Bahasa Indonesia](./CHANGELOG.id.md)

All notable changes to Aika are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## How to write entries

This changelog is read by the people **maintaining client projects**, not by the people who wrote Aika. Write for that reader.

- **State the impact, not the diff.** "The `/api/users` route now requires a session", not "changed middleware in features/users/server/routes.ts".
- **Every entry that changes behaviour must answer:** does a client project need to do something? If yes, link to its section in [docs/UPGRADING.md](./UPGRADING.md).
- **Categories:** `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- The `Unreleased` section is always present at the top.

Versioning rule: a change that forces a client project to edit code or configuration is a **major** change, even when nothing fails to compile.

## [Unreleased]

### Added

- **A cover image picker in the blog editor, and a categories screen at `/blog/admin/categories`.** The picker offers the existing media library rather than a second upload path, because a second path would be a second copy of the byte validation, the resizing, and the SVG refusal, and the copy that gets fixed is never the one in use. Deleting an image leaves the post published without a picture rather than deleting the post, which is a foreign key decision the migration makes deliberately and one test pins.
- **A `blog` feature, so a client site can publish articles.** `/blog` lists published posts with category filters, `/blog/<slug>` is one article, and `/blog/admin` is where staff write them. A post is a title, a URL slug generated from the title, a summary, a Markdown body, an optional cover image from the media library, and a category. Drafts are visible to staff only; publishing needs an administrator, because publishing is the step that puts words in front of the public. **Action required:** run `npm run db:migrate` for `0006_blog.sql`, which only creates tables. See [docs/UPGRADING.md](./UPGRADING.md).
- **Markdown, rendered on the server, by a renderer that escapes its input.** Not a rich text editor, and not a third party Markdown library: a post is text, so it is stored as text, and the HTML is built on the server from escaped input. Raw HTML in a post is shown as text rather than interpreted, which means there is no sanitiser to forget and no way for an author to inject a script into a reader's page. Deliberately unsupported: tables, footnotes, embedded HTML, and syntax highlighting.
- **`POST /api/blog/admin/categories`**, administrator only. Categories are structure rather than content, so they follow the same rule as publishing.
- **`npm run user:password -- --email=<address>`, so a forgotten password is recoverable.** Until now the only way back into a deployment whose administrator had forgotten their password was to create another administrator and abandon the account, and there is no delete-user command, so the abandoned one stayed forever. The command generates a password, prints it once, and ends every session that account holds, because a reset that leaves a signed-in browser working has not reset anything. It refuses `--password` on purpose: a password on a command line lands in shell history and in the process list. **Action required: none**, but it is worth trying once on a throwaway account before you need it. See [docs/UPGRADING.md](./UPGRADING.md).
- **`generatePassword`, in the auth feature rather than in a script.** `user:create` and `user:password` both need one, and a second copy would be a second strength decision that only one of them gets fixed later.

### Fixed

- **A dynamic segment in a feature page produced a route that never matched.** A record pushed into `pages:extend` skips Nuxt's own filename scanning, so `/blog/[slug]` reached vue-router as a literal string, compiled to a regex matching the text "[slug]", and returned 404 for every real address. The route was registered, appeared in the generated route list, and silently matched nothing. `shared/nuxt/feature-pages.ts` now converts a filesystem segment to the syntax vue-router routes on, and the unit tests pin that form rather than the broken one that agreed with it.

### Changed

- **The staff surfaces are gated by role, and the media library says who may touch it.** An `editor` can upload, list, and delete media, because producing content is the job. An `editor` cannot read the staff inbox, because a visitor's enquiry is personal data about somebody who never agreed to be in a database, and that is administration rather than content work. An `editor` who opens the inbox page is sent home instead of meeting a broken screen. `admin` can do everything. **Action required: none**, but an account that was created as `editor` now actually behaves like one. See [docs/UPGRADING.md](./UPGRADING.md).
- **`requireAtLeast(c, role)` and `atLeast(role)`, beside the existing exact-match guard.** The obvious way to gate the media library was `requireRole(c, 'editor')`, and it is wrong: an exact match refuses the administrator, which is backwards from what any operator expects. `requireAtLeast` states what is meant, and adding a third role later fails the gate until somebody writes down where it sits.
- **`carriesAtLeast`, in `features/auth/contract.ts`.** The ordering had to move out of the server guard, because the browser has to reach the same verdict when it decides whether to show a page. One function, both doors, so a page and the API cannot disagree about who is allowed in.

- **A source-reading test was deleted and replaced with a real one.** The browser gate had been "proven" by asserting that a middleware file contained certain strings, and it passed with the role comparison removed. The decision is now a pure function with four tests that fail in both directions, and the redirect itself was checked against the built artefact rather than asserted. A test that cannot fail for the thing it names is worse than no test, because it reads as evidence.

- **Role enforcement, and the last phase 1 item to go.** `users.role` existed and nothing read it, so every signed-in user was an administrator whatever the table said. It is enforced now. `requireRole(c, 'admin')` opens a handler that is administrator only, `roleGuard('admin')` covers a whole route group, and a signed-in `editor` gets a 403 rather than the page. The refusal message is the same for every role pair, so it does not describe what the caller is missing. The role is read from the user row on every request, because sessions store no role, so a promotion or a demotion takes effect on the next request through the same code path in both directions. **Action required: none, but everybody is still an administrator, so now is the moment to decide who should not be.** See [docs/UPGRADING.md](./UPGRADING.md).
- **`GET /api/auth/users`, administrator only.** The first route behind the new guard, and the seam that makes enforcement observable rather than assumed. It lists accounts. It is not a user management screen, and there is still no route for creating, disabling, or changing another account.
- **`npm run user:role -- --email=<address> --role=admin|editor`.** Moves an existing account between the two roles, and reports what changed and what it means for that person.
- **The last active administrator is protected.** `disableAccount` and `changeRole` refuse a change that would leave none, with a `ConflictError` that names the command that recovers it. An editor is not cover for this: a deployment whose only administrator is gone cannot reach any administrator only route, and the only way back is a shell. This is the same reasoning as the last active account guard beside it, one level down.

- **A `role` test suite, and three existing tests made honest.** The role tests were mutation tested rather than trusted: they were checked to go red when the guard is deleted and again when it is off by one, and the first version did neither reliably. Along the way, shuffling test order found two defects that had nothing to do with roles and were shipped before this change: the sign in burst test depended on another test having created its account, and the staff inbox test compared against rows that a neighbouring test had dated in 2030. Both are fixed by making the test carry its own premise.
- **`AGENTS.md`, `ARCHITECTURE.md` and `SECURITY.md` now describe enforced roles** rather than saying the role column is decorative. The most-read rule in this repository was the one that had gone false.

- **A `media` feature.** A staff member uploads an image at `/media`, and Aika stores it, records it, and serves it back at `/media/<filename>`, which is the URL that gets pasted into content. Images larger than 1920 pixels on their longest edge are shrunk to fit before they are stored, so a phone photo does not arrive on a client's homepage at full size, and an image already small enough is kept byte for byte rather than re-encoded. The bytes are checked to actually be an image rather than taken on trust from the browser, uploaded filenames are generated rather than borrowed, and SVG is refused on purpose: it is a document that can carry script, and served from your own origin it would run in your own origin. Files can be deleted, which removes the record and the bytes together. **Action required:** a deployment must set `MEDIA_ROOT`, or uploaded files land inside the application directory where a redeploy removes them, and `sharp` is a native dependency, so the artefact has to be built for the platform that will run it. See [docs/UPGRADING.md](./UPGRADING.md).

- **CI, at `.github/workflows/check.yml`.** It runs the gate, builds, migrates a fresh database, then starts the built server and asks it questions: that `/api/health` reports the database up, that the home page renders a header, and that `/contact/messages` still redirects a signed out visitor. A build that produces something which cannot serve a page is not a passing build. This matters more than usual because Aika is worked on in bursts, and the failure that hurts is the project quietly stopping working while it sits.
- **`ROADMAP.md` and `ROADMAP.id.md`.** The single place that answers what is being built next and why. Its discipline: shipped work leaves the roadmap entirely and appears here instead, so the two files never overlap.
- **`npm run prose:check`**, wired into `npm run check`. It refuses em dashes and en dashes anywhere in the repository, in either language and in code comments. Use a comma, a colon, a full stop, or parentheses. A plain hyphen is still fine inside words and ranges such as `R1-R6`.
- **Test suite.** `vitest` 5, running in the `node` environment with no Nuxt build and no HTTP server. 23 tests across 2 files, in under a second. `npm run check` now runs them.
- **`shared/nuxt/feature-pages.ts`**, plus 12 unit tests for it. The route computation was extracted out of the Nuxt module so it could be tested without booting Nuxt. Tests build temporary feature trees and assert the resulting route paths.
- **`features/health/web/pages/index.vue`**, served at `/health`. It is both a useful status page and the proof that feature pages work.
- **`shared/http/envelope.ts`**: the failure envelope as a Zod schema, so the envelope rule in AGENTS.md is checkable rather than aspirational. The success envelope stays per feature, because its `data` is owned by the feature that returns it.
- **Tailwind CSS v4**, wired through `@tailwindcss/vite` rather than a Nuxt module. `app/assets/css/palette.css` holds the tokens for both themes, and `main.css` maps them onto Tailwind's theme, so components use `bg-card` and `text-muted-foreground` instead of hex values.
- **`@source` declarations for `app/` and `features/`.** Tailwind v4 detects sources automatically, but `features/` is a sibling of `app/` rather than a child of it, so relying on the heuristic is a silent failure mode. Verified: classes used only by `features/health/web/pages/index.vue` do appear in the built CSS.

- **`docs/aika/BUILDING.md`**: how to add a feature, end to end, using the `health` feature as the worked example. Every snippet is real code, and it is now the document to read first.

- **`auth` feature.** Sign in, sign out, and sessions. Passwords are hashed with scrypt from `node:crypto`, so no new dependency was added. Sessions live in SQLite and only the token's SHA-256 is stored, so a leaked database does not hand over live sessions. Cookies are `httpOnly` and `sameSite=Lax`. 24 new tests.
- **`app/middleware/auth.ts`**, so any page can require a session with `definePageMeta({ middleware: 'auth' })`.
- **`npm run user:create`**, which creates the first user. There is no sign up screen, on purpose: a client site has a handful of staff accounts, not open registration.
- **`shared/database/migrate.ts`**: the migration logic, extracted out of the script so the test setup applies exactly the code the deploy applies.

- **A working site shell.** `app/layouts/default.vue`, `app/components/SiteHeader.vue` and `SiteFooter.vue`, and three real pages: Home, About, and Contact. Until now `npm run dev` produced a status panel and nothing that resembled a website, which made it genuinely hard to see how Aika is meant to be used.
- **`app/site.ts`**, the one file to edit when starting a client project: site name, tagline, navigation, contact details, and document language. `nuxt.config.ts` reads the name and the language from it as well, so a rebrand is one file rather than a hunt.

- **The `contact` feature and the reference form.** A `contact_messages` table, `POST /api/contact` with Zod validation, a honeypot that drops obvious bots while answering as though it succeeded, and a form on `/contact`. 15 tests. This is the rung that shows the whole stack in one place: migration, contract, route, validation, the response envelope, and a form that displays the server's own error text.
- **`shared/http/error-message.ts`**, so the sign in form and the contact form turn a thrown fetch error into something readable in one place rather than two.

- **The staff inbox at `/contact/messages`, behind a session.** `GET /api/contact/messages` returns the hundred most recent submissions, newest first, and the page renders them with a triage hint when the user agent looks automated. Five tests, including one that proves a message the honeypot dropped never appears in the list, and one that proves the cap holds.

- **A password can be changed, and an account can be revoked.** `features/auth/web/pages/password.vue` serves `/auth/password`, `auth` serves `POST /api/auth/password`, and `scripts/manage-users.ts` adds `user:list`, `user:disable` and `user:enable`. Revocation is a shell command rather than a web screen, because whoever runs the deployment already has a shell, and a web route would let any signed-in user lock out any other while every account is an administrator.
- **Changing a password ends every other session.** A session that outlives the change defeats the reason for making it, so `changePassword` deletes every session for that user except the one that asked. The response says how many it ended, because a number above zero is worth noticing.
- **Disabling an account takes effect immediately, and cannot lock everybody out.** The timestamp and the session deletion happen together: either alone is not revocation. Disabling the last active account is refused, because locking everybody out of a client's deployment is a bad enough afternoon to justify one guard, and the refusal is recoverable from the same shell.
- **`createUser` refuses a password under twelve characters**, so `--password=short` is not a way around a rule the web form has to follow.
- **`resolveSessionDetail` replaces `resolveSession` internally.** It returns the session id alongside the user, because changing a password has to end every other session and spare this one. `resolveSession` keeps its old shape and now delegates.

- **SEO, from one composable.** `app/composables/usePageSeo.ts` emits the description, the Open Graph pair, the Twitter card, and a canonical URL from the title and description a page actually has. `app/pages/*` use it. It deliberately does not invent a description: that tag is what decides whether a search result gets clicked, and one repeated across every page is worse than a considered one on the pages that have it.
- **`/robots.txt` and `/sitemap.xml`, as Nitro routes.** Hono is reached through exactly one adapter and owns `/api`, and an XML document is not an API response, so these belong to Nitro. Both bodies come from `shared/seo/site-files.ts`, which is pure and unit tested, and the CI smoke test asserts the routes actually resolve.
- **A 404 and 500 page that is not the Nuxt default.** `app/error.vue` keeps the site chrome through the layout, offers a way out, keeps itself out of search results, and shows the underlying message in development only, because on a live site that message is a gift to anybody probing. A browser gets HTML and a client that does not accept HTML gets JSON, which is Nitro content-negotiating correctly; both the file and the CI job say so, because it cost a diagnosis to learn.
- **`site.url` and `site.socialImage`, both empty by default.** Empty is the safe state rather than an unfinished one: a canonical aimed at a placeholder tells a search engine the real page lives somewhere it does not, and a sitemap full of example.com URLs asks it to index somebody else's domain. While `url` is empty, pages emit no canonical and no Open Graph URL, and `/sitemap.xml` is a valid but empty urlset. Setting one field switches all of it on.

### Changed

- **Every staff screen now declares itself as tooling, with `noindex, nofollow`.** A status page, a sign in form, a password form, a list of a client's inbound messages, and the error page itself are not content, and none of them belongs in a search result. `robots.txt` cannot do this: `Disallow` asks a crawler not to fetch a path, and a page can be indexed from a link without ever being fetched.
- **`arch:check` gained two rules, and both were verified by breaking them on purpose.** R7 refuses the combination where `app/layouts/` exists but `app/app.vue` does not wrap `NuxtPage` in `NuxtLayout`: the bug that made every layout silently do nothing. R8 refuses a top level directory that is not in the map printed in `docs/aika/README.md`, and refuses a map entry with no directory behind it. The README is the source of truth on purpose, so there is no second list to forget. Documenting `.github/` exposed a blind spot in R8: the reverse check only looked at non-dot directories, so it would have called that entry a lie about a directory that plainly exists. Both directions are now checked against the full listing.
- **The staff inbox lives at `/contact/messages`, not `/admin/messages`.** Feature pages are always mounted under their feature's own name, which is what stops two features both claiming `/admin`. A shared admin area is a Phase 2 question.
- **The rule for where a screen lives is now written down.** `features/contact/` is a pure backend slice and `app/components/ContactForm.vue` is the client's. The dividing line is not frontend versus backend, it is what every client shares versus what only this client has. `features/health` and `features/auth` do own pages, because a status panel and a sign in form are tooling rather than branding. See `docs/aika/ARCHITECTURE.md`.
- **The test setup empties every table it finds** rather than the two it used to name, so a new feature cannot leak state into the next run by being forgotten.
- **The reference site is branded Aika, not a fictional client.** It said "Meridian Studio" with agency copy, which left a reader guessing what they were actually looking at. The pages now say what they are and where to read next, which is the whole job of an example.
- **`app/components/AikaWatermark.vue`**, a small fixed mark in the corner of every page, switched by `site.watermark` in `app/site.ts`. It is the agency's credit rather than the client's, so it is a separate switch from the site name: a client changes the name, the studio decides about the mark.
- **`app/app.vue` now wraps `<NuxtPage>` in `<NuxtLayout>`.** It did not before, so `app/layouts/` was never applied and `definePageMeta({ layout: ... })` was silently ignored with no warning anywhere. Found while building the site shell, and it would have cost somebody an afternoon.
- **The home page no longer proves the loop.** `/health` carries that job now, and it is the page to open when confirming a deployment is wired correctly. A client home page should not be a status panel.
- The sign in page opts out of the site chrome with `definePageMeta({ layout: false })`. A navigation bar above a login form invites people to wander off instead of signing in. The endpoint at `/api/health` stays public, because uptime monitoring cannot sign in. This split is deliberate: one surface is for machines, the other is for people.
- `scripts/migrate.ts` is now a thin CLI wrapper around `shared/database/migrate.ts`, keeping the snapshot-first deploy ceremony in one place.
- **Session TTL is 30 days**, absolute rather than sliding.
- **Test count is now 47**, up from 23. The root `README.md` now belongs to the client project, so a client can describe their own site without ever conflicting with an upstream change. This was a real defect: `README.md` was not on the list of files a client may edit, which left a client repository whose front page described Aika instead of the client. `AGENTS.md` stays at the root because agent tooling looks for it there, and `LICENSE` stays by legal convention. Every relative link was rewritten and checked.
- The root `README.md` is a short signpost here, and the client's own front page in a client project. It is now on the list of files that legitimately differ per client. `modules/features.ts` loaded without error from the very first commit but had never been exercised, because no feature had a `web/pages/` directory. It was the last unverified architectural claim in the project. It is now covered by unit tests and confirmed in a production build: `GET /health` renders the feature page, and `useHead` applies the title.
- `npm run check` now also runs the test suite.
- **New writing rule for every document and comment: no em dashes, no en dashes.** The characters are invisible in review, so nobody notices one being added. That is why this is enforced by a script rather than written down and trusted.
- **Indonesian documentation rewritten to read naturally.** The earlier versions were translated word for word, which produced passive-heavy sentences with English clause structure. Translating a document is not the same as writing one.
- `npm run check` now runs `prose:check` as well.
- **All code is English.** Identifiers, comments, test names, and the code blocks inside the Indonesian documentation. Client-facing copy under `app/` and `features/<name>/web/` is the only exception, and `prose:check` now enforces the split.
- **Styling rule: Tailwind utilities and semantic tokens only.** No `<style>` blocks in components, and no raw hex values. A new top-level directory holding components must be declared under `@source`, or its classes are silently never generated.

## [0.1.0] - 2026-10-28

First release. The foundation stands; there is no domain feature yet.

### Added

- **Distribution model:** no monorepo. Each client project is a clone of this repo, with improvements pulled via `git merge upstream/main`. The framework/client boundary is what keeps that merge cheap.
- **Feature convention** (`contract.ts` / `index.ts` / `server/` / `web/` / `tests/`) with boundaries enforced by `npm run arch:check`.
- **Two boundaries per feature.** `index.ts` is the server door; `web/index.ts` is the browser-safe door. Without the split, a Vue component importing a feature type would drag `better-sqlite3` into the client bundle.
- **`health` reference feature**, proving the chain Nuxt → Nitro → Hono → SQLite end to end.
- **`modules/features.ts`:** pages in `features/*/web/pages/` become Nuxt routes automatically, so no feature has to edit application routing.
- **`shared/config/env.ts`:** the only place `process.env` is read, validated by Zod, failing at boot with a readable message.
- **`shared/database/client.ts`:** the only place SQLite is opened, owning the WAL pragmas including `foreign_keys` and `busy_timeout`, which are not defaults anywhere.
- **`shared/errors/`:** domain errors carrying a stable `code` and HTTP `status`.
- **`shared/http/app.ts`:** the Hono composition root and the single place errors are mapped to the JSON envelope.
- **`server/api/[...path].ts`:** the one Nitro → Hono adapter. Hono imports nothing from Nitro, so a standalone Hono process remains a one-file swap.
- **`scripts/migrate.ts`:** forward-only SQL migrations that write a snapshot first and refuse to run if the snapshot fails.
- **`scripts/db-backup.ts`:** online snapshot via better-sqlite3's `.backup()`, with retention. Deliberately not `cp`, which would capture a torn WAL state.
- **`scripts/check-boundaries.ts`:** six boundary rules (R1-R6), including browser-safety and cycle detection.
- **`ecosystem.config.cjs`:** PM2 `fork` mode with a single instance, with the reasoning written in the file.
- Documentation: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/UPGRADING.md`, each with an Indonesian counterpart.
- **`allowScripts` pinned** in `package.json` for `better-sqlite3` and `esbuild`. npm 11 holds back install scripts by default; without this pin, a fresh clone would be missing the native SQLite binary.

### Verified at this release

Not claims, observed output:

- `npm run check` green: Nuxt typecheck, scripts typecheck, `arch:check` (1 feature, 0 violations).
- `npm run build` green: Nitro `node-server` preset, `.output/server/index.mjs` emitted.
- `GET /api/health` → `200 {"success":true,"message":"OK","data":{"status":"ok","version":"0.1.0","database":"up","uptimeSeconds":1}}`.
- Unknown `/api` path → `404 {"success":false,"message":"Endpoint not found.","code":"NOT_FOUND"}`.
- `GET /` renders the health panel into server HTML (`Database: up`), SSR works, not just the API.
- `npm run db:migrate` applied `0001_init.sql`, then reported "up to date" on re-run (idempotent).
- `npm run db:backup` and the pre-migration snapshot both wrote valid files.

### Notes for downstream projects

There are no client projects yet. Nothing to do.

[Unreleased]: https://github.com/Kreavia-Dev/aika/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kreavia-Dev/aika/releases/tag/v0.1.0
