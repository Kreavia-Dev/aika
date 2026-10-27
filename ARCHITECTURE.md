# Aika Architecture

**English** · [Bahasa Indonesia](./ARCHITECTURE.id.md)

This document is the **architecture authority**. If code disagrees with this document, the document is right and the code needs fixing.

## Locked stack

| Area | Choice |
|---|---|
| Language | TypeScript, `strict: true` |
| Runtime | Node.js >= 22 (team runs 24) |
| Frontend | Nuxt 4.6 (SSR) + Vue 3.5 |
| HTTP | Hono 4, mounted inside Nitro |
| Database | SQLite via `better-sqlite3`, raw SQL |
| Validation | Zod 4, schemas owned by features |
| Process | One Node process, PM2 `fork` mode, single instance |
| Package manager | npm |

This is not a list of preferences. These are decisions that have already been made, so they are not re-argued in every client project.

## The feature model

The primary unit is a **feature**: one business capability kept together.

```text
features/billing/
├── contract.ts       # this feature's Zod schemas and inferred types
├── index.ts          # SERVER boundary: one door for server code
├── server/           # routes, services, repositories, config
├── web/              # optional browser surface
│   ├── index.ts      # BROWSER boundary: one door for browser code
│   ├── pages/        #   -> auto-routed by modules/features.ts
│   └── components/
└── tests/
```

### Two boundaries, not one

A feature has **two doors**, and they are not interchangeable:

| Door | Consumer | May contain |
|---|---|---|
| `index.ts` | server code, other features' server code | anything |
| `web/index.ts` | Vue components, other features' `web/` code | browser-safe code and types only |

**Why this exists.** `features/health/index.ts` exports `healthRoutes`, which imports `better-sqlite3`. A Vue component importing from `index.ts` would drag a native Node module into the browser bundle. Importing from `web/` instead makes that mistake structurally impossible, and rule **R6** in `npm run arch:check` catches it if anyone tries anyway.

This is not hypothetical. It was found while building the reference feature: the first version of the home page imported the type from `index.ts`, and TypeScript could not type the response because the contract was not reachable through a browser-safe door.

Types cost the browser nothing: `import type` is erased at build time, so re-exporting a type through `web/index.ts` adds zero bytes.

### Rules

1. **`index.ts` and `web/index.ts` are the only doors.** Cross-feature imports must go through one of them. `import { x } from '~~/features/users/server/repository'` is refused by `npm run arch:check`.
2. **`contract.ts` is never imported directly from outside the feature.** It is re-exported through both doors. One door per consumer type, not two ways in.
3. **`server/` and `web/` are private** to other features. Inside the owning feature, use whatever you like.
4. **The application may import features; features may not import the application.** No file under `features/` may touch `app/`.
5. **Features never open a database connection.** Always through `shared/database/client`.
6. **`web/` code never imports server-only modules.** Not `node:*` builtins, not `better-sqlite3`, not `shared/database`, not its own `server/`.
7. **The feature dependency graph is acyclic.**

All seven are enforced by `scripts/check-boundaries.ts` (`npm run arch:check`), rules R1-R6. It is a heuristic text-based lint, not a compiler. A specifier built from a template string can fool it. It catches the mistakes people actually make.

### Why features, not layers

One test: *"I need to change how invoice cancellation works. How many folders do I open?"*

Grouped by layer, the answer is four or more: `controllers/`, `services/`, `models/`, `components/`. Grouped by feature, the answer is one.

The consequence that matters most for Aika's business model: **deleting a feature.** Per feature, it is `rm -rf features/invoices` plus one line in `shared/http/app.ts`. Per layer, it is hunting through six folders and hoping nothing was missed.

The trade-off is accepted deliberately: **duplication is allowed.** Two features may have similar-looking helpers. Extraction happens only when three or more features share logic that is *semantically identical* and changes for the same reason. Never extract on resemblance.

The trap to avoid: a `shared/` folder that grows into a second layer. `shared/` holds business-neutral infrastructure only. If a file mentions a domain noun (blog, invoice, user), it does not belong there.

## Application and shared layers

- **`app/`**: the Nuxt application shell: `app.vue`, `layouts/`, `pages/`. Browser composition.
- **`server/`**: the Nitro directory. Exactly one file: `server/api/[...path].ts`, the Hono adapter.
- **`shared/config/`**: the only place `process.env` is read, validated by Zod, failing at boot.
- **`shared/database/`**: the only place SQLite is opened, owning the pragmas.
- **`shared/errors/`**: domain errors with a stable `code` and HTTP `status`.
- **`shared/http/app.ts`**: the **server composition root**: the Hono app and every feature mount.
- **`modules/features.ts`**: the Nuxt module that registers `features/*/web/pages/` as routes.

`shared/http/` is a deliberate exception to "`shared/` is business-neutral": composition has to live somewhere, and one small file is a better place than scattering mounts across features.

## HTTP and contracts

### Envelope

Every `/api` response uses the same shape:

```jsonc
// success
{ "success": true,  "message": "OK", "data": { } }

// failure
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Error messages are in English. This is API surface, not UI copy. User-facing text is translated on the client.

### Validation

No handler trusts input. Every body and query is validated by Zod **at the route boundary**, before the handler runs. TypeScript types are derived from the same schema (`z.infer`), so there is never a second source of truth.

Handlers may also `parse` their own response on the way out. That sounds redundant and is deliberate: it is where contract drift becomes a loud failure in development instead of a silent shape change in production.

### Errors

Handlers throw `AppError` (or a subclass: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Mapping to the JSON response happens in exactly one place: `api.onError` in `shared/http/app.ts`. **No handler builds an error response by hand.**

### Why Hono inside Nitro

| Option | Why not |
|---|---|
| Separate Hono process | Every SSR render pays a real TCP round-trip, and browser cookies are not forwarded automatically. Authenticated pages can intermittently render logged-out. Plus two deploy units, two health checks, two log streams per VPS. |
| Nitro routes only | Loses Hono's middleware and validation ergonomics, and locks the API to Nitro permanently. |
| **Hono inside Nitro** | **Chosen.** One process, one deploy, no cookie plumbing. |

What keeps this healthy: the Hono app in `shared/http/app.ts` **imports nothing from Nitro**. If a client ever needs standalone Hono, it is a one-file swap, not a rewrite.

## Configuration

`shared/config/env.ts` is the only place `process.env` is read. Everything downstream receives a validated, typed object, and the process fails at boot with a readable message rather than crashing later inside a request handler.

**`PORT` is deliberately not in that schema.** Nitro owns the listening socket and reads `PORT` itself, defaulting to 3000. Mirroring it in application config would create a second source of truth that can silently disagree with the port actually bound. This was observed during the initial build: the server came up on 3000 while application config claimed 5555.

- Development: 5555, via `devServer.port` in `nuxt.config.ts`.
- Production: whatever `PORT` says in the environment file. If it disagrees with the reverse proxy upstream, the site 502s, so keep both in one place.

## Database

### Pragmas

Applied in one place, `shared/database/client.ts`:

```js
journal_mode = WAL
busy_timeout = 5000
synchronous  = NORMAL
foreign_keys = ON
wal_autocheckpoint = 1000
```

Two of these are not defaults anywhere and must not be skipped: `better-sqlite3` does **not** enable foreign key enforcement by default, and `busy_timeout` has no safe default.

### Migrations

Raw SQL, forward-only, applied in filename order. `npm run db:migrate` writes a snapshot first and refuses to run if the snapshot fails.

Three rules:

1. Never edit a migration that may already have been applied anywhere.
2. Never drop a column in the same release that stops writing to it.
3. Migrations are **not** part of app boot. They are a separate deploy step. If they ran on boot, rolled-back code would meet a migration that already advanced, unrecoverable by restart.

To undo something, write a new migration that reverses it. There are no down migrations.

### One database per client

Each client is a separate VPS with its own database file. Isolation is free, backups restore trivially, and cross-tenant query bugs are impossible. A `tenant_id` column buys nothing here and only adds a filter that will eventually be forgotten.

A detail that frustrates people once: the `-wal` and `-shm` files are part of the database. A backup that copies only the `.db` file while the application is running captures a torn state. That is why `scripts/db-backup.ts` uses better-sqlite3's `.backup()`, not `cp`.

### SQLite in production

WAL gives concurrent readers plus **one writer**. The practical ceiling: when write transactions are long enough that `busy_timeout` starts producing `SQLITE_BUSY` under normal load, or when you need multiple application servers writing to the same file. For client sites, that ceiling is rarely reached.

That is why `ecosystem.config.cjs` uses `exec_mode: 'fork'` with `instances: 1`. Cluster mode means N processes = N connections = N writers contending on one file lock. Because SQLite serialises writes at the file level, extra writers add no throughput at all, only `SQLITE_BUSY` variance.

The database file, its WAL sidecars, and backups **must** live on storage local to the application host. Never on a shared network filesystem.

## Distribution model: why there is no monorepo

This is the decision that shapes the repository, so the reasoning is recorded in full.

**The requirement:** Aika keeps improving, and those improvements must reach client projects that are already live. That means sync, and sync means something has to give.

What is impossible: **two-way sync.** What is possible: **one-way, deliberate, versioned propagation of the parts you chose to share.** Choosing that boundary is a design decision, not an implementation detail.

| Strategy | Sync mechanism | Why |
|---|---|---|
| Copy once, forget | none | Aika rots; client #2 starts from a worse baseline than client #5. Rejected. |
| Monorepo + versioned packages | `npm up @aika/base` | Works, but trades the merge problem for semver discipline and a private registry. Rejected: it is disliked, and it forces pnpm for a protection that only matters inside a monorepo. |
| **Repo copy + `git pull upstream`** | `git merge upstream/main` | **Chosen.** |

Why the third one works here when it usually rots: **because the boundary is enforced, not because git is magic.**

`git pull upstream` rots when there is no boundary, when client code and framework code are mixed in the same files. In Aika the boundary is real and checkable:

- Aika updates touch `shared/`, `server/`, `modules/`, files a client never changes.
- Client work lives in `features/<client-specific>/`.
- What may differ per client is a closed list, and the list is short.

Two nearly disjoint file sets → a trivial merge.

**`npm run arch:check` is the price of this decision.** It is what keeps the boundary real. If the boundary leaks, the distribution model breaks. This is not a tidiness issue.

### Files that legitimately differ per client

A closed list. Everything else belongs to Aika.

| File | Why |
|---|---|
| `app/pages/*`, `app/layouts/*`, `app/app.vue` | Client UI and branding |
| `shared/http/app.ts` | Per-client feature mount lines |
| `features/<client-specific>/**` | All custom work |
| `database/migrations/*` | Add new files only |
| `.env`, `ecosystem.config.cjs` | Process name and secrets |

Every other file: if you need to change it for one client, **change it in Aika first**, then pull it down. If the change makes no sense for Aika, it is probably in the wrong place.

## Recorded decisions

| Decision | Short reason |
|---|---|
| TypeScript at the trunk, JS allowed at the leaves | The real cost is upstream→client integration. Types turn "500 on a rarely-opened page" into "build failed". |
| Two boundaries per feature | `index.ts` reaches `better-sqlite3`; `web/index.ts` cannot. The type system and R6 enforce the difference. |
| No ORM, raw SQL | Types come from Zod in `contract.ts`, not from an ORM. Fewer moving parts, less to learn. |
| `PORT` not in the env schema | One source of truth per fact. Nitro owns the socket. |
| `allowScripts` pinned to exact versions | npm 11 makes install scripts opt-in. Pinning is deliberate supply-chain hygiene, re-approved per upgrade. |
| No monorepo, no pnpm | See the distribution model above. |
| One Node process | See "Why Hono inside Nitro". |
| Forward-only migrations | Down migrations in SQL are rarely written correctly and more often lie. |
| English docs default, Indonesian secondary | English is the ecosystem default; Indonesian is the team's reading language. |

## What Aika does not build

This list matters as much as the contents. If an idea lands here, the answer is no unless there is a very strong reason.

No custom runtime, HTTP framework, ORM, auth framework, DI container, RPC system, compiler, language, build tool, **monorepo tool**, multi-stack configurator, or AI wrapper.

Aika organises and protects application boundaries. The ecosystem owns the stack.

## Design filters

Before adding anything to Aika, pass it through these three questions:

1. **Does this strengthen the boundary between Aika and the client?** If not, it is probably client code.
2. **Can an ecosystem tool solve it?** If yes, use that tool directly rather than wrapping it.
3. **Can it be inferred from code and convention?** If yes, infer it, do not add metadata that can drift out of sync.
