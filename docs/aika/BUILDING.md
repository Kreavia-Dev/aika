# Building a feature

**English** · [Bahasa Indonesia](./BUILDING.id.md)

## What this is for

This is the **how**. [ARCHITECTURE.md](./ARCHITECTURE.md) is the **why**.

It walks through adding one business capability, end to end, using the `health`
feature in this repository as the reference. Every snippet is real code you can
open and read.

If you read only one Aika document, read this one.

## The shape of a feature

```
features/invoices/
├── contract.ts       # Zod schemas, and the TypeScript types inferred from them
├── index.ts          # SERVER boundary: the door server code walks through
├── server/
│   ├── routes.ts     # Hono routes for this feature
│   ├── service.ts    # optional: business rules
│   └── repository.ts # optional: SQL
├── web/
│   ├── index.ts      # BROWSER boundary: the door browser code walks through
│   ├── pages/        # becomes routes automatically, under /invoices
│   └── components/
└── tests/
```

`contract.ts` and `index.ts` are required, and `arch:check` refuses a feature
without them. Everything else appears when the feature actually needs it. Do not
create empty folders to look complete.

## Step 1: write the contract first

Start here, before routes and before UI. The contract is the feature's public
promise, and Zod gives you runtime validation and compile-time types from one
source.

```ts
// features/invoices/contract.ts
import { z } from 'zod'

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  total: z.number().int().nonnegative(),
  issuedAt: z.string(),
})

export const invoiceListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ invoices: z.array(invoiceSchema) }),
})

export type Invoice = z.infer<typeof invoiceSchema>
export type InvoiceListResponse = z.infer<typeof invoiceListResponseSchema>
```

Write the type once, and let `z.infer` produce it. If you ever find yourself
writing the same shape twice, the second one will drift.

## Step 2: the server routes

```ts
// features/invoices/server/routes.ts
import { Hono } from 'hono'
import { listInvoices } from './repository'
import { invoiceListResponseSchema } from '../contract'

export const invoiceRoutes = new Hono()

invoiceRoutes.get('/invoices', (c) => {
  const payload = invoiceListResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { invoices: listInvoices() },
  })

  return c.json(payload)
})
```

Three rules apply to every route:

1. **Validate the input before the handler body.** Query strings and bodies are
   parsed with Zod first. Never trust a parameter.
2. **Throw `AppError` subclasses.** `NotFoundError`, `ValidationError`, and the
   rest live in `shared/errors`. Do not build an error response by hand.
3. **Parse the response too.** It looks redundant and it is deliberate: this is
   where contract drift becomes a loud failure in development instead of a
   silent shape change in production.

None of the routes above calls a guard, which means they are public. That is a
decision, not an omission: `/api/health` has to answer an uptime monitor that
cannot sign in. Any route that should not be public needs one, below.

A fourth applies as soon as a route is not public. `features/health` is the worked
example above and it is public on purpose, so this is the shape rather than that
feature's code:

```ts
import { requireUser, requireRole } from '../../auth'

invoiceRoutes.get('/invoices', (c) => {
  // Signed in is enough, and any staff member may see an invoice.
  requireUser(c)
  // ...
})

invoiceRoutes.get('/invoices/export', (c) => {
  // Administrator only. An editor gets a 403 with code FORBIDDEN.
  requireRole(c, 'admin')
  // ...
})
```

Call the guard as the first line, before reading the body, so an anonymous
request costs one indexed select and no parsing. For a whole group, use
`invoiceRoutes.use('/invoices/admin/*', roleGuard('admin'))` instead.

Deciding which one a route needs is a question about the business, not about the
code: does every staff member need this, or only the person who administers the
site? Write the answer in a comment above the route, because the next person will
have to answer it again when they add a route beside yours.

## Step 3: the two doors

This is the part that is easiest to get wrong, so read it properly.

```ts
// features/invoices/index.ts  -> the SERVER door
export { invoiceRoutes } from './server/routes'
export type { Invoice, InvoiceListResponse } from './contract'
```

```ts
// features/invoices/web/index.ts  -> the BROWSER door
export type { Invoice, InvoiceListResponse } from '../contract'
```

They are not interchangeable:

| Import from | Use it in |
|---|---|
| `~~/features/invoices` | server code, and other features' server code |
| `~~/features/invoices/web` | Vue components, and other features' `web/` code |

**Why the split is not ceremony.** The server door exports `invoiceRoutes`,
which eventually imports `better-sqlite3`. A Vue component importing from the
server door drags that native Node module into the browser bundle. Importing
from `web/` makes that mistake impossible, and rule R6 in `npm run arch:check`
catches anyone who tries anyway.

Types cost the browser nothing. `import type` is erased at build time.

## Step 4: mount it

One line, in one file:

```ts
// shared/http/app.ts
api.route('/', invoiceRoutes)
```

This is the only place a client project is expected to disagree with Aika, and
it is why the file is on the list of files that legitimately differ per client.
Keep it to mount lines.

## Step 5: a browser page

Put a `.vue` file in `features/invoices/web/pages/` and it becomes a route under
the feature's own name. No routing file to edit anywhere.

| File | Route |
|---|---|
| `web/pages/index.vue` | `/invoices` |
| `web/pages/create.vue` | `/invoices/create` |
| `web/pages/[id].vue` | `/invoices/[id]` |

```vue
<script setup lang="ts">
import type { InvoiceListResponse } from '../index'

const { data, error } = await useFetch<InvoiceListResponse>('/api/invoices')
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-2xl font-semibold tracking-tight">Invoices</h1>

    <p v-if="error" class="text-destructive">{{ error.message }}</p>

    <ul v-else-if="data" class="mt-6 space-y-2">
      <li v-for="invoice in data.data.invoices" :key="invoice.id">
        {{ invoice.number }}
      </li>
    </ul>
  </main>
</template>
```

Two things to notice:

- **`useFetch<InvoiceListResponse>` is not optional.** Without the type
  parameter the response is typed `{}`, and a server-side contract change fails
  silently instead of breaking your build.
- **Styling is Tailwind utilities and semantic tokens.** No `<style>` block, no
  hex values. See [AGENTS.md](../../AGENTS.md), "Styling".

## Step 6: run the gate

```bash
npm run check
```

That runs the Nuxt typecheck, the scripts typecheck, `arch:check`,
`prose:check`, and the test suite. It must be green before the work is finished.
There is no exception and no "fix it later", because this repository is cloned
into every client project and a broken gate multiplies.

## Step 7: if it needs a table

Add a new file to `database/migrations/`. Migrations are plain SQL, applied in
filename order, forward-only.

```sql
-- database/migrations/0002_invoices.sql
CREATE TABLE invoices (
  id         TEXT    PRIMARY KEY,
  number     TEXT    NOT NULL UNIQUE,
  total      INTEGER NOT NULL CHECK (total >= 0),
  issued_at  TEXT    NOT NULL
);
```

```bash
npm run db:migrate
```

Three rules, and `npm run db:migrate` enforces the first one for you by writing a
snapshot before it applies anything:

1. Never edit a migration that may already have been applied anywhere. Add a new
   file.
2. Never drop a column in the same release that stops writing to it.
3. Never add a column to a table another feature owns. A feature owns its tables.

Migrations are a deploy step, never app boot. See
[UPGRADING.md](./UPGRADING.md) for why.

## Step 8: test it

Tests go in two places, and the distinction is about what they need to run:

| Kind | Location | Covers |
|---|---|---|
| Unit | `tests/unit/` | Pure logic with no framework |
| Feature | `features/<name>/tests/` | That feature's endpoints |

```ts
// features/invoices/tests/invoices.test.ts
import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { invoiceListResponseSchema } from '../contract'

describe('GET /api/invoices', () => {
  it('conforms to the schema the feature publishes', async () => {
    const response = await api.request('/api/invoices')
    const parsed = invoiceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })
})
```

Drive the real Hono app. It is fast, because `shared/http/app.ts` imports nothing
from Nitro, and a Web `Request` is enough. Do not mock it.

Parse the body rather than asserting fields one at a time. `response.json()` is
typed `unknown`, so parsing through the schema is both the validation and the
narrowing, and it checks the published contract instead of a copy of it.

## The worked example in this repository

Open `features/health/` and read it in this order:

| File | What to notice |
|---|---|
| `contract.ts` | The schema, and that the type is inferred rather than written |
| `server/routes.ts` | Validate, then parse your own response before returning |
| `index.ts` | The server door, and the comment explaining the trap |
| `web/index.ts` | The browser door, and that it exports types only |
| `web/pages/index.vue` | A feature owned route, and a typed `useFetch` |
| `tests/health.test.ts` | Driving the real app, parsing through the contract |

It is small on purpose. Everything in this document is visible in those six
files.

## Mistakes that are easy to make

| Mistake | What catches it |
|---|---|
| Deep import across features, such as `~~/features/users/server/repository` | `arch:check` rule R2 |
| Browser code importing the server door | `arch:check` rule R6 |
| A feature without `contract.ts` or `index.ts` | `arch:check` rule R1 |
| A circular dependency between two features | `arch:check` rule R5 |
| Opening SQLite directly inside a feature | `arch:check` rule R4 |
| A layout that silently does nothing because `app.vue` does not wrap `NuxtPage` in `NuxtLayout` | `arch:check` rule R7 |
| A top level directory that is missing from the map in `docs/aika/README.md` | `arch:check` rule R8 |
| An em dash or an en dash anywhere | `prose:check` |
| Indonesian in framework code | `prose:check` |
| Classes that never appear in the CSS | Nothing. See the note below |

That last row is the one to remember. Tailwind only generates classes from
directories declared under `@source` in `app/assets/css/main.css`. If you add a
new top-level directory that holds components, add its `@source` line. Otherwise
the classes are silently never generated, with no error anywhere.
