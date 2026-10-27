# Aika

**English** · [Bahasa Indonesia](./README.id.md)

Internal application kit for building client web applications. **Nuxt + Hono + SQLite**, TypeScript, one Node process, deployed to a VPS with PM2.

Aika is not open source and not a framework. It is a **living starting point**: every client project begins as a clone of this repository, then keeps pulling improvements from `upstream` with git, no manual copying.

## Verified baseline

Aika has been built and run, not only written.

| | Version |
|---|---|
| Node | 24.22.1 (`.nvmrc`) |
| npm | 11.19.1 |
| Nuxt | 4.6.3 |
| Vue / vue-router | 3.5.44 / 5.4.0 |
| Hono | 4.x |
| Zod | 4.6.7 |
| better-sqlite3 | 12.11.1 |
| TypeScript | 5.9.3 |

Evidence, as of the initial commit: `npm run check` green, `npm run build` green, `GET /api/health` → `200 {"success":true,...,"database":"up"}`, `npm run db:migrate` idempotent on re-run, and the health panel renders into server HTML.

> **Nuxt 4 requires `vue-router ^5.4.0`.** Pinning vue-router 4 makes `npm run typecheck` fail with a confusing `vue-router/volar/...` resolution error while the build still succeeds. Do not downgrade it.

## Layout

```
app/                  the client's site: pages, layouts, components, site.ts
  site.ts             site name, tagline, nav, contact. Edit this first
  app.vue             the root, and it must wrap NuxtPage in NuxtLayout
  layouts/default.vue the site chrome shared by every page
  components/         SiteHeader, SiteFooter
  middleware/auth.ts  sends a signed out visitor to the sign in page
features/             vertical slices, one business capability each
  auth/               sign in, sessions, the page guard
  health/             status, and the reference for a minimal feature
shared/               business-neutral infrastructure
  config/env.ts       the ONLY place process.env is read, validated by Zod
  database/client.ts  the ONLY place SQLite is opened, owns the WAL pragmas
  database/migrate.ts the migration runner, used by the CLI and the tests
  errors/             domain errors with a stable code and HTTP status
  http/app.ts         Hono composition root
  nuxt/feature-pages.ts   turns features/*/web/pages/ into route records
server/api/[...path].ts   the single Nitro → Hono adapter
modules/features.ts   wires feature pages into Nuxt
tests/                unit tests, and the database setup the suite runs on
database/migrations/  forward-only SQL
docs/aika/            Aika's own documentation
scripts/              migrate, backup, create-user, architecture and prose checks
```

## Requirements

- Node.js >= 22 (the team runs 24, see `.nvmrc`)
- npm

## Getting started

```bash
npm install
cp .env.example .env
npm run setup      # applies migrations (snapshots the database first)
npm run dev        # http://localhost:5555
```

Open the home page. If it shows `Database: up`, the whole chain is wired: Nuxt → Nitro → Hono → SQLite.

**About `allowScripts` in `package.json`:** npm 11 holds back dependency install scripts until they are approved. `package.json` already pins approval for `better-sqlite3` (which needs `node-gyp rebuild` for its native binary) and `esbuild`. If you add a dependency that needs an install script, npm will warn you and the command to review it is:

```bash
npm install-scripts ls
npm install-scripts approve <package>
```

The pin is per exact version, deliberately. When `better-sqlite3` is upgraded, approval must be granted again, that is a supply-chain feature, not an annoyance.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR on :5555 |
| `npm run build` | Production build into `.output/` |
| `npm start` | Run the built output locally |
| `npm run check` | **The canonical gate.** Nuxt typecheck + scripts typecheck + arch:check + prose:check + test |
| `npm run typecheck` | Typecheck the Nuxt/Vue side |
| `npm run typecheck:scripts` | Typecheck `scripts/`, `shared/`, `features/` and the tests |
| `npm run arch:check` | Enforce the feature boundary rules |
| `npm run prose:check` | Refuse em and en dashes in any document |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Watch mode while you work |
| `npm run db:migrate` | Apply migrations (snapshots first) |
| `npm run db:backup` | Online SQLite snapshot, keeps the newest 14 |
| `npm run user:create` | Create a user. There is no sign up screen, on purpose |

`npm run check` must be green before a PR is merged. That is the Definition of Done in this repository.

## Starting a new client project

Distribution is **git upstream**: not copy-paste, and not a monorepo.

```bash
git clone git@github.com:Kreavia-Dev/aika.git client-name
cd client-name

# Aika's origin becomes upstream; the new origin belongs to the client.
git remote rename origin upstream
git remote add origin git@github.com:Kreavia-Dev/client-name.git

npm install
cp .env.example .env
npm run setup
git push -u origin main
```

From here `upstream` is Aika and `origin` is the client. Nothing else ever needs to know Aika exists.

## Pulling improvements from Aika

```bash
git fetch upstream
git merge upstream/main
```

**This stays painless only because the boundary is real.** Most Aika updates land in `shared/`, `server/`, and `modules/`, files a client project never touches. Client work lives in `features/<client-specific>/`. Two nearly disjoint file sets means a trivial merge.

If merging starts to hurt, that is a signal the boundary has leaked, not a signal that the model is wrong. Fix the boundary, then run `npm run arch:check`.

### Files that legitimately differ per client

Everything else belongs to Aika; do not change it without a strong reason.

- `app/pages/*`, `app/layouts/*`, `app/app.vue`
- `shared/http/app.ts`, the feature mount lines only
- `features/<client-specific>/**`
- `database/migrations/*`, add files, never edit them
- `.env`, `ecosystem.config.cjs`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full list with reasoning, and [docs/UPGRADING.md](./UPGRADING.md) for the upgrade procedure.

## Deployment

```bash
# Local machine or CI: never build on the VPS.
npm ci
npm run check
npm run build

# Ship the artefact.
rsync -az --delete .output/ vps:/srv/aika/
rsync -az database/migrations/ vps:/srv/aika/database/migrations/

# On the VPS. Migrate BEFORE reloading, always.
ssh vps 'cd /srv/aika && npm run db:backup && npm run db:migrate && pm2 reload aika'
```

Migrations are never run on app boot. If they ran on boot, rolled-back code would meet a migration that already advanced, and a restart cannot fix that.

`ecosystem.config.cjs` uses `fork` mode with a single instance on purpose. See the comment inside it and the SQLite section of ARCHITECTURE.md.

Environment lives at `/etc/aika/env` on the VPS, outside the deployed directory.

## Language convention

| | Language |
|---|---|
| Documentation (`README.md`, `ARCHITECTURE.md`, …) | **English is the default** |
| Indonesian translations | same name + `.id.md` |
| Code, identifiers, comments, commits, `AGENTS.md` | English |

This README is the canonical version. [`README.id.md`](./README.id.md) is a translation kept in sync in the same pull request. When the two disagree, the English file is correct.

One style rule applies to both languages: **no em dashes and no en dashes.** Use a comma, a colon, a full stop, or parentheses. `npm run prose:check` enforces it.

## Documentation

| Document | Contents |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | What is being built next, and why. Shipped work moves out of it |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | **The authority.** Locked stack, feature model, boundaries, why each decision was made |
| [AGENTS.md](../../AGENTS.md) | Contract for AI coding agents |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution and review rules |
| [docs/UPGRADING.md](./UPGRADING.md) | Procedure for pulling updates into client projects |
| [CHANGELOG.md](./CHANGELOG.md) | Aika's version history |
| [SECURITY.md](./SECURITY.md) | Secret handling and vulnerability policy |
