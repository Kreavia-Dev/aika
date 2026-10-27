# AGENTS.md — instructions for AI coding agents working in Aika

**English** · [Bahasa Indonesia](./AGENTS.id.md)

Read this before writing code. `ARCHITECTURE.md` is the authority. If this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins — say so instead of guessing.

## What Aika is

An internal (non-open-source) application kit for building client web apps. Nuxt + Hono + SQLite, TypeScript, one Node process, PM2 on a VPS.

It is distributed by cloning the repo per client project and pulling improvements from `upstream` with git. **That only stays mergeable while the framework/client boundary is real.** Most of the rules below exist to protect that boundary, not for tidiness.

## Commands

```bash
npm run check              # THE canonical gate. Must be green before you say you are done.
npm run typecheck          # Nuxt/Vue side
npm run typecheck:scripts  # scripts/, shared/, features/
npm run arch:check         # feature boundary rules R1-R6
npm run dev                # dev server on :5555
npm run db:migrate         # apply migrations (snapshots first)
npm run db:backup          # online SQLite backup
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
// refused — deep cross-feature import (R2)
import { getCurrentUser } from '~~/features/auth/server/repository'

// refused — imports server boundary from browser code (R6)
import type { Post } from '~~/features/blog'
```

Do not import another feature's `contract.ts` directly either — it is re-exported through both doors. One door per consumer type.

### 3. Features never import from `app/`

`app/` is the browser shell. It depends on features; features never depend on it.

### 4. Never open your own database connection

`shared/database/client.ts` is the only place `new Database(...)` appears. It owns the pragmas. Import `getDb()` from there.

### 5. Never duplicate a `/api` route in Nitro

Every `/api` path belongs to Hono, mounted in `shared/http/app.ts`, reached through the single adapter `server/api/[...path].ts`. Do not add `server/api/*.ts` files. Do not add Nitro route handlers that shadow Hono.

### 6. Errors

Throw `AppError` subclasses from `shared/errors` (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Never build an error response by hand — `api.onError` in `shared/http/app.ts` maps them, and it is the only place that does.

### 7. Every response uses the envelope

```jsonc
{ "success": true,  "message": "OK", "data": { } }
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Error messages are in English; they are API surface, not UI copy.

### 8. Validate at the boundary with Zod, always

Request bodies and query strings are validated before the handler runs. Types come from the schema via `z.infer` — never write the type twice.

## TypeScript rules

You are writing TypeScript for a team that is still learning it. Optimise for readability, not cleverness.

- **`strict: true` is on. Never disable it. Never add `// @ts-ignore`.** If something genuinely cannot be typed, use `// @ts-expect-error` **with a comment explaining why**.
- **Never use `any`.** Use `unknown` and narrow it.
- **Prefer inference over annotation.** `const x = { a: 1 }` — do not annotate what TypeScript already knows. Annotate function parameters, return types of public functions, and API/database shapes.
- **No type gymnastics.** No custom mapped types, conditional types, or hand-written generics unless there is no alternative. Anonymous object types are better than named generic machinery here.
- **Derive types, don't duplicate them.** `z.infer<typeof schema>` for validation shapes.
- `.js` files are permitted and will continue to be. Do not propose a big-bang conversion of anything.

## Environment and configuration

- **`PORT` is not in the env schema, on purpose.** Nitro owns the listening socket and reads `PORT` itself (default 3000). Do not add it to `shared/config/env.ts` — a second source of truth for the port is exactly the bug we removed.
- **Do not read `process.env` anywhere except `shared/config/env.ts`.** Add a field to the Zod schema there instead.
- **`allowScripts` in `package.json` pins install-script approval to exact versions.** When you upgrade `better-sqlite3`, npm will warn and you must run `npm install-scripts approve better-sqlite3`. Never set `dangerously-allow-all-scripts`.

## SQLite and migrations

- Migrations are plain SQL in `database/migrations/`, applied in filename order, **forward-only**.
- Never edit a migration that may already have been applied anywhere. Add a new file.
- Never drop a column in the same release that stops writing to it.
- Migrations are a deploy step, never app boot.
- Do not add a column to a table another feature owns. A feature owns its own tables.

## What not to add

Aika deliberately has no custom runtime, HTTP framework, ORM, auth framework, DI container, RPC layer, build tool, monorepo tool, or AI wrapper.

Before adding a dependency, check `ARCHITECTURE.md` → "What Aika does not build" and "Design filters". If a mainstream ecosystem tool already solves it, use that tool directly rather than wrapping it.

## Documentation language

- **English is the default.** `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/UPGRADING.md`.
- **Indonesian is secondary.** Same filename plus `.id.md`.
- **Both files are updated in the same change.** A change that updates only one language is incomplete.
- Code, identifiers, comments, commit messages, and this file: **English**.

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
