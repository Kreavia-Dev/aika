# Contributing

**English** · [Bahasa Indonesia](./CONTRIBUTING.id.md)

Internal repository. Everything here is about keeping Aika safe to distribute into client projects.

## Before you start

Read [ARCHITECTURE.md](./ARCHITECTURE.md). Most review comments in this repository are about boundaries, and the reasoning lives there.

## The gate

```bash
npm run check
```

This runs `typecheck`, `typecheck:scripts`, and `arch:check`. It must be green before a pull request is merged. There is no exception and no "fix it in a follow-up". This repo is cloned into every client project, so a broken gate multiplies.

If `arch:check` fails, fix the boundary. Do not relax the rule unless you have changed ARCHITECTURE.md first and explained why.

## Branches and commits

- Branch: `feat/…`, `fix/…`, `docs/…`, `chore/…`, short and specific.
- Commits: imperative mood, English, one logical change per commit.
  - `add blog feature skeleton`
  - `refuse deep cross-feature imports in post web boundary`
  - not `fixes` or `wip`

## Pull request checklist

Paste this into the PR description and fill it in:

```md
## What
## Why
## Boundary impact
- [ ] No client-owned file touched, or: listed below and justified
- [ ] New `/api` routes live in a feature and are mounted in shared/http/app.ts
- [ ] Browser code imports only from ~~/features/<name>/web
- [ ] New dependency justified against ARCHITECTURE.md → "What Aika does not build"

## Verification
- [ ] npm run check
- [ ] npm run build
- [ ] migration applied and re-run (idempotent)
- [ ] docs updated in BOTH languages

## Downstream impact
- [ ] No action needed by client projects, or: docs/UPGRADING.md updated
```

## Changing the framework/client boundary

This is the highest-stakes change you can make, because it is what keeps `git merge upstream/main` cheap in every client project.

If your change modifies any file on the "legitimately differs per client" list, or makes a file on that list conflict-prone, say so explicitly in the PR.

**If you need to change something for one client only:** change it in Aika first, then pull it down. If it makes no sense for Aika, it probably belongs in that client's `features/<client-specific>/`.

## Documentation

- English is the default: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/UPGRADING.md`.
- Indonesian is secondary: same name plus `.id.md`.
- **Both are updated in the same PR.** A reviewer may reject a PR that updates only one.
- When the two disagree, the English file is correct.

## Writing style

Applies to both languages.

- **Never use an em dash or an en dash.** Use a comma, a colon, a full stop, or parentheses. A plain hyphen is fine inside words and ranges such as `R1-R6`. Enforced by `npm run prose:check`, which runs as part of `npm run check`.
- A short sentence beats one that needs three commas to hold together.
- Prefer the active voice.
- If a rule matters, make it a script rather than a sentence in a document.

## User-visible changes need a changelog entry

Write for the person maintaining a client project, not for the person who wrote the diff:

- Say the impact, not the diff. "The `/api/users` route now requires a session", not "changed middleware in features/users/server/routes.ts".
- Every entry that changes behaviour must answer: does a client project need to do something? If yes, link to its section in [docs/UPGRADING.md](./UPGRADING.md).
- A change that forces a client project to edit code or configuration is **major**, even if nothing fails to compile.

## Reviewing

A reviewer's job here is boundary protection first, code quality second. Ask:

1. Does this leak across a boundary, Aika/client, server/browser, feature/feature?
2. Would this conflict in a client project that has diverged?
3. Is there a domain noun in `shared/`?
4. Are both language versions updated?

## Tests

There is no test runner configured yet. That is a known gap, not a policy.. See the changelog's "Unreleased" section. Until it exists, state explicitly in the PR what you did to verify, and include the actual command output rather than a claim.
