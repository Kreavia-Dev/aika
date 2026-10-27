# Project name

<!--
This file belongs to the project, not to Aika.

In a client project: replace everything below with your own README. Describe the
site, how to run it, and anything the next person needs to know. This file is
yours, and Aika will not touch it.

In the Aika repository itself: this is a signpost and it stays short. Aika's own
documentation lives in docs/aika/.
-->

Built on **Aika**. Framework documentation starts at
[docs/aika/README.md](./docs/aika/README.md).

## Running it

```bash
npm install
cp .env.example .env
npm run setup      # applies migrations (snapshots the database first)
npm run dev        # http://localhost:5555
```

`npm run check` is the gate. It must be green before anything ships.

## Where things live

| Path | What it is |
|---|---|
| `app/` | The Nuxt shell: layouts and pages owned by this project |
| `features/` | One folder per business capability, each with its own contract, server routes, and browser pages |
| `shared/` | Infrastructure with no domain in it: config, database, errors, HTTP |
| `docs/aika/` | Aika's documentation, updated by `git pull upstream`. Do not edit it here |
| `database/migrations/` | Forward-only SQL. Add files, never edit them |

## Learning the conventions

Start with [docs/aika/BUILDING.md](./docs/aika/BUILDING.md). It walks through
adding a feature end to end, using the `health` feature in this repository as the
worked example.
