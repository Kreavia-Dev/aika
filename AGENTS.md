# AGENTS.md: instructions for AI coding agents working in Aika

**English** · [Bahasa Indonesia](./AGENTS.id.md)

Read this before writing code. `docs/aika/ARCHITECTURE.md` is the authority. If this file and that one disagree, the architecture document wins. Say so instead of guessing.

## What Aika is

An internal (non-open-source) application kit for building client web apps. Nuxt + Hono + SQLite, TypeScript, one Node process, PM2 on a VPS.

It is distributed by cloning the repo per client project and pulling improvements from `upstream` with git. **That only stays mergeable while the framework/client boundary is real.** Most of the rules below exist to protect that boundary, not for tidiness.

## Commands

```bash
npm run check              # THE canonical gate. Must be green before you say you are done.
npm run typecheck          # Nuxt/Vue side
npm run typecheck:scripts  # scripts/, shared/, features/
npm run arch:check         # feature boundary rules R1-R6
npm run prose:check        # refuses em and en dashes anywhere
npm run dev                # dev server on :5555
npm run db:migrate         # apply migrations (snapshots first)
npm run db:backup          # online SQLite backup
npm run test               # run the suite once
npm run test:watch         # watch mode while you work
```

Run `npm run check` before reporting completion. Never report success on the basis of "it should work".

## Hard rules

### 1. Build by feature, not by layer

A feature is one business capability kept in one place:

```
features/<name>/
├── contract.ts   # Zod schemas + inferred types
├── index.ts      # SERVER boundary
├── server/       # routes, services, repositories, config
├── web/          # optional browser surface
│   ├── index.ts  # BROWSER boundary
│   ├── pages/    # auto-routed by modules/features.ts
│   └── components/
└── tests/
```

Do not create `controllers/`, `services/`, `models/`, `repositories/` directories at the top level. If you feel tempted, the logic belongs inside a feature.

### 2. A feature has TWO doors, and they are not interchangeable

| Import from | Allowed in |
|---|---|
| `~~/features/<name>` | server code, other features' server code |
| `~~/features/<name>/web` | Vue components, other features' `web/` code |

**Getting this wrong is the single easiest way to break a client build.**

`~~/features/health` exports `healthRoutes`, which imports `better-sqlite3`. Importing it from a Vue component pulls a native Node module into the browser bundle. Browser code must import from `~~/features/<name>/web`.

Both of these are refused by `arch:check`:

```ts
// refused: deep cross-feature import (R2)
import { getCurrentUser } from '~~/features/auth/server/repository'

// refused: imports server boundary from browser code (R6)
import type { Post } from '~~/features/blog'
```

Do not import another feature's `contract.ts` directly either. It is re-exported through both doors. One door per consumer type.

### 3. Features never import from `app/`

`app/` is the browser shell. It depends on features; features never depend on it.

### 4. Never open your own database connection

`shared/database/client.ts` is the only place `new Database(...)` appears. It owns the pragmas. Import `getDb()` from there.

### 5. Never duplicate a `/api` route in Nitro

Every `/api` path belongs to Hono, mounted in `shared/http/app.ts`, reached through the single adapter `server/api/[...path].ts`. Do not add `server/api/*.ts` files. Do not add Nitro route handlers that shadow Hono.

### 6. Errors

Throw `AppError` subclasses from `shared/errors` (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Never build an error response by hand, `api.onError` in `shared/http/app.ts` maps them, and it is the only place that does.

### 7. Every response uses the envelope

```jsonc
{ "success": true,  "message": "OK", "data": { } }
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Error messages are in English; they are API surface, not UI copy.

### 8. Validate at the boundary with Zod, always

Request bodies and query strings are validated before the handler runs. Types come from the schema via `z.infer`. Never write the type twice.

## TypeScript rules

You are writing TypeScript for a team that is still learning it. Optimise for readability, not cleverness.

- **`strict: true` is on. Never disable it. Never add `// @ts-ignore`.** If something genuinely cannot be typed, use `// @ts-expect-error` **with a comment explaining why**.
- **Never use `any`.** Use `unknown` and narrow it.
- **Prefer inference over annotation.** `const x = { a: 1 }`. Do not annotate what TypeScript already knows. Annotate function parameters, return types of public functions, and API/database shapes.
- **No type gymnastics.** No custom mapped types, conditional types, or hand-written generics unless there is no alternative. Anonymous object types are better than named generic machinery here.
- **Derive types, don't duplicate them.** `z.infer<typeof schema>` for validation shapes.
- `.js` files are permitted and will continue to be. Do not propose a big-bang conversion of anything.

## Environment and configuration

- **`PORT` is not in the env schema, on purpose.** Nitro owns the listening socket and reads `PORT` itself (default 3000). Do not add it to `shared/config/env.ts`. A second source of truth for the port is exactly the bug we removed.
- **Do not read `process.env` anywhere except `shared/config/env.ts`.** Add a field to the Zod schema there instead.
- **`allowScripts` in `package.json` pins install-script approval to exact versions.** When you upgrade `better-sqlite3`, npm will warn and you must run `npm install-scripts approve better-sqlite3`. Never set `dangerously-allow-all-scripts`.

## Authentication

`features/auth/` owns authentication, and it is the reference for a feature that uses both boundaries at once.

- **A handler that must not run anonymously calls `requireUser(c)` as its first line.** For a whole route group, `api.use('/admin/*', authGuard)`.
- **Never read the session cookie yourself.** `currentUser(c)` returns the user or null, and it already handles expiry.
- **Never hash a password outside `features/auth/server/password.ts`.** From anywhere else, use `createUser`.
- **A page that must not be shown anonymously uses `definePageMeta({ middleware: 'auth' })`.** The middleware must use `useRequestFetch`, not `useFetch`, or server rendering will treat a signed-in visitor as signed out.
- **`users.role` exists and nothing enforces it.** Every signed-in user is currently an administrator. Do not build a feature that assumes otherwise.
- **Sign in is not rate limited.** See `docs/aika/SECURITY.md` for what that means in practice.

## Where a screen lives

- **A screen every client would rewrite goes in `app/`, not in a feature.** A screen every client shares, such as a status panel or a sign in form, can live in a feature.
- **A feature with no UI is normal.** `features/contact/` is a table, a contract, and an endpoint. Do not add a page to it just so it has one.
- **Browser code imports a feature through `~~/features/<name>/web`, never through `~~/features/<name>`.** The server door reaches `better-sqlite3`, and rule R6 refuses the import that would drag it into the browser bundle.

## Testing

```bash
npm run test        # run once
npm run test:watch  # watch mode while you work
```

Tests run in the `node` environment, with no Nuxt build and no HTTP server. `npm run check` runs the suite, so a failing test blocks the gate.

- **Unit tests** go in `tests/unit/`. Anything needing no framework belongs there.
- **Feature tests** go in `features/<name>/tests/`. One file per feature is enough until it is not.
- **Drive the real Hono app.** `import { api } from '../../../shared/http/app'`, then `await api.request('/api/...')`. Do not mock it.
- **Parse the body, do not assert fields one at a time.** `response.json()` is typed `unknown`. Pass it through the feature's Zod schema from `contract.ts`. That validates and narrows in one step, and it checks the contract rather than a copy of it.
- **For error responses**, parse with `failureEnvelopeSchema` from `shared/http/envelope.ts`.
- **Scratch scripts and probes must point `DATABASE_PATH` at a throwaway file.** The default is the development database, and a one-off script that writes rows will quietly destroy it. `npm run test` is already isolated by `vitest.config.ts`. Anything you run by hand is not, and there is no mechanical guard for it, so it belongs here as a rule rather than in a script.
- **Every `/api` response uses the envelope.** A new response shape that does not use it is a bug, not a variation.

## SQLite and migrations

- Migrations are plain SQL in `database/migrations/`, applied in filename order, **forward-only**.
- Never edit a migration that may already have been applied anywhere. Add a new file.
- Never drop a column in the same release that stops writing to it.
- Migrations are a deploy step, never app boot.
- Do not add a column to a table another feature owns. A feature owns its own tables.

## What not to add

Aika deliberately has no custom runtime, HTTP framework, ORM, auth framework, DI container, RPC layer, build tool, monorepo tool, or AI wrapper.

Before adding a dependency, check `ARCHITECTURE.md` → "What Aika does not build" and "Design filters". If a mainstream ecosystem tool already solves it, use that tool directly rather than wrapping it.

## Where the documentation lives

| Path | Owner | Why there |
|---|---|---|
| `README.md` | **the client project** | A client replaces it with their own front page. Aika does not change it, so it never conflicts |
| `AGENTS.md` | Aika | At the root by convention: agent tooling looks for it there, so it cannot move |
| `docs/aika/**` | Aika | Every other Aika document. Updated by `git pull upstream`, never edited locally |
| `LICENSE` | Aika | At the root by legal convention |

If a change affects behaviour a client project depends on, update the document
under `docs/aika/`. The root README is not Aika's to write.

Start here: [docs/aika/BUILDING.md](./docs/aika/BUILDING.md) for the how, and
[docs/aika/ARCHITECTURE.md](./docs/aika/ARCHITECTURE.md) for the why.

## Documentation language

- **English is the default.** Every file under `docs/aika/`, plus `AGENTS.md`.
- **Indonesian is secondary.** Same filename plus `.id.md`.
- **Both files are updated in the same change.** A change that updates only one language is incomplete.
- **Code is English without exception**: identifiers, comments, test names, commit messages, and this file. Mixed-language code reads badly for people and worse for tools, and framework code is merged into every client project.
- **The one exception is client-facing copy.** `app/**` and `features/<name>/web/**` are the browser surface, so a client site written for Indonesian readers legitimately contains Indonesian there. `npm run prose:check` enforces exactly this split.

## Styling

Tailwind CSS v4, wired through the `@tailwindcss/vite` plugin rather than a Nuxt module.

- **Use utility classes.** Do not add a `<style>` block to a component. If something genuinely cannot be expressed as utilities, say why in the pull request.
- **Use the semantic tokens, never a raw hex value.** `bg-card`, `text-muted-foreground`, `border-border`, `text-destructive`, `text-success`. A hard coded colour is a rebranding bug waiting to happen.
- **Change colours in `app/assets/css/palette.css`**, never in a component. That file is the single source of truth, and every token has a dark value.
- **A directory is only scanned if `app/assets/css/main.css` declares it** under `@source`. If you add a top-level directory holding components, add its `@source` line. Otherwise its classes are never generated, and nothing reports an error.

## Writing style

Applies to every document in this repository, in both languages.

- **Never use an em dash or an en dash.** Use a comma, a colon, a full stop, or parentheses instead. A plain hyphen is fine inside words and ranges such as `R1-R6`. `npm run prose:check` refuses the two banned characters and runs as part of `npm run check`.
- **Keep sentences short.** If a sentence needs three commas to stay together, split it.
- **Prefer the active voice.** "The script refuses deep imports" reads better than "deep imports are refused".
- **If a rule matters, make it a script.** A rule that only lives in a document decays. `arch:check` and `prose:check` exist for exactly that reason.

## Definition of done

A change is done when:

1. `npm run check` is green.
2. Any new `/api` route lives in a feature and is mounted in `shared/http/app.ts`.
3. Browser code imports only from `~~/features/<name>/web`.
4. Any schema change has a new migration file.
5. Both language versions of any affected documentation are updated.
6. The new behaviour has at least one test, or you have stated explicitly why it does not.
7. `CHANGELOG.md` and `CHANGELOG.id.md` are updated when the change is visible to downstream client projects.

## When you are unsure

Say so. State the assumption, state what you could not verify, and ask. A wrong silent guess in a boilerplate multiplies across every client project derived from it.
