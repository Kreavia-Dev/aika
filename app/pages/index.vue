<script setup lang="ts">
/**
 * The application's landing page.
 *
 * It exists to prove the whole loop end to end:
 *   Nuxt page -> Nitro -> Hono -> SQLite
 * If this renders "Database: up", the foundation is wired correctly.
 *
 * This page belongs to the application, not to a feature, and a client project
 * replaces it. Pages owned by a feature live in `features/<name>/web/pages/`
 * and are mounted under the feature's own name, for example `/health`.
 *
 * The type comes from the health feature's browser-safe boundary,
 * `~~/features/health/web`. Importing from `~~/features/health` would pull the
 * `better-sqlite3` native module into the client bundle, and rule R6 in
 * `npm run arch:check` refuses that.
 */
import type { HealthResponse } from '~~/features/health/web'

const { data, error, refresh, status } = await useFetch<HealthResponse>('/api/health')
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-3xl font-semibold tracking-tight">
      Aika
    </h1>
    <p class="mt-1 text-muted-foreground">
      Internal application kit. Build by feature, not by layer.
    </p>

    <section class="mt-10 rounded-lg border border-border bg-card p-6">
      <h2 class="mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Health
      </h2>

      <p v-if="error" class="font-semibold text-destructive">
        Could not reach the API: {{ error.message }}
      </p>

      <dl v-else-if="data" class="mb-5">
        <div class="flex justify-between border-b border-border py-2">
          <dt class="text-muted-foreground">
            Status
          </dt>
          <dd class="tabular-nums">
            {{ data.data.status }}
          </dd>
        </div>
        <div class="flex justify-between border-b border-border py-2">
          <dt class="text-muted-foreground">
            Database
          </dt>
          <dd
            class="font-semibold tabular-nums"
            :class="data.data.database === 'up' ? 'text-success' : 'text-destructive'"
          >
            {{ data.data.database }}
          </dd>
        </div>
        <div class="flex justify-between border-b border-border py-2">
          <dt class="text-muted-foreground">
            Version
          </dt>
          <dd class="tabular-nums">
            {{ data.data.version }}
          </dd>
        </div>
        <div class="flex justify-between py-2">
          <dt class="text-muted-foreground">
            Uptime
          </dt>
          <dd class="tabular-nums">
            {{ data.data.uptimeSeconds }}s
          </dd>
        </div>
      </dl>

      <p v-else class="text-faint">
        Loading...
      </p>

      <div class="mt-5 flex items-center gap-3">
        <button
          type="button"
          class="rounded-md border border-line-strong bg-card px-3.5 py-1.5 text-sm transition-colors hover:bg-muted"
          @click="refresh()"
        >
          Check again
        </button>
        <small class="text-faint">last request: {{ status }}</small>
      </div>
    </section>

    <p class="mt-8 text-sm text-muted-foreground">
      This page belongs to the application. A page owned by a feature is at
      <NuxtLink to="/health" class="text-accent-foreground underline underline-offset-2">
        /health
      </NuxtLink>.
    </p>
  </main>
</template>
