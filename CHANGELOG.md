# Changelog

**English** · [Bahasa Indonesia](./CHANGELOG.id.md)

All notable changes to Aika are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## How to write entries

This changelog is read by the people **maintaining client projects**, not by the people who wrote Aika. Write for that reader.

- **State the impact, not the diff.** "The `/api/users` route now requires a session", not "changed middleware in features/users/server/routes.ts".
- **Every entry that changes behaviour must answer:** does a client project need to do something? If yes, link to its section in [docs/UPGRADING.md](./docs/UPGRADING.md).
- **Categories:** `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- The `Unreleased` section is always present at the top.

Versioning rule: a change that forces a client project to edit code or configuration is a **major** change, even when nothing fails to compile.

## [Unreleased]

### Added

- **`ROADMAP.md` and `ROADMAP.id.md`.** The single place that answers what is being built next and why. Its discipline: shipped work leaves the roadmap entirely and appears here instead, so the two files never overlap.
- **`npm run prose:check`**, wired into `npm run check`. It refuses em dashes and en dashes anywhere in the repository, in either language and in code comments. Use a comma, a colon, a full stop, or parentheses. A plain hyphen is still fine inside words and ranges such as `R1-R6`.
- **Test suite.** `vitest` 5, running in the `node` environment with no Nuxt build and no HTTP server. 23 tests across 2 files, in under a second. `npm run check` now runs them.
- **`shared/nuxt/feature-pages.ts`**, plus 12 unit tests for it. The route computation was extracted out of the Nuxt module so it could be tested without booting Nuxt. Tests build temporary feature trees and assert the resulting route paths.
- **`features/health/web/pages/index.vue`**, served at `/health`. It is both a useful status page and the proof that feature pages work.
- **`shared/http/envelope.ts`**: the failure envelope as a Zod schema, so the envelope rule in AGENTS.md is checkable rather than aspirational. The success envelope stays per feature, because its `data` is owned by the feature that returns it.
- **Tailwind CSS v4**, wired through `@tailwindcss/vite` rather than a Nuxt module. `app/assets/css/palette.css` holds the tokens for both themes, and `main.css` maps them onto Tailwind's theme, so components use `bg-card` and `text-muted-foreground` instead of hex values.
- **`@source` declarations for `app/` and `features/`.** Tailwind v4 detects sources automatically, but `features/` is a sibling of `app/` rather than a child of it, so relying on the heuristic is a silent failure mode. Verified: classes used only by `features/health/web/pages/index.vue` do appear in the built CSS.

### Changed

- **The feature page mechanism is now proven.** `modules/features.ts` loaded without error from the very first commit but had never been exercised, because no feature had a `web/pages/` directory. It was the last unverified architectural claim in the project. It is now covered by unit tests and confirmed in a production build: `GET /health` renders the feature page, and `useHead` applies the title.
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
