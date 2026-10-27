<script setup lang="ts">
/**
 * The health feature's browser page. Served at /health.
 *
 * Besides being genuinely useful for a quick look at a deployment, this page is
 * the proof that feature owned routing works: a feature puts a file in its own
 * `web/pages/`, and the route appears, with no change to the application's
 * routing anywhere.
 *
 * It is also the page that proves the whole loop end to end, Nuxt to Nitro to
 * Hono to SQLite. If it renders "Database: up", the foundation is wired
 * correctly. The public home page deliberately does not do this.
 *
 * The type comes from `../index`, the feature's browser-safe boundary.
 * Importing from `../` instead would pull `better-sqlite3` into the client
 * bundle, and rule R6 in `npm run arch:check` refuses that.
 */
import type { HealthResponse } from '../index'

useHead({
  title: 'System status',
  // Tooling rather than content. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

/*
 * Staff only. Without a session the middleware sends the visitor to
 * /auth/login. The API at /api/health stays public, because monitoring needs
 * it and a machine cannot sign in.
 */
definePageMeta({ middleware: 'auth' })

const { data, error, refresh, status } = await useFetch<HealthResponse>('/api/health')
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-2xl font-semibold tracking-tight">
      System status
    </h1>
    <p class="mt-1 text-muted-foreground">
      This page belongs to the <code class="font-mono text-sm">health</code> feature, not to the application.
    </p>

    <section class="mt-10 rounded-lg border border-border bg-card p-6">
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

    <p class="mt-8 rounded-md border-l-2 border-line-strong bg-muted px-4 py-3 text-sm text-muted-foreground">
      Note: this page requires a session. The machine readable endpoint at
      <code class="font-mono text-xs">/api/health</code> stays public so uptime
      monitoring keeps working.
    </p>

    <!--
      Two staff screens now exist, and neither is linked from the public footer
      beyond "Staff". A real staff area, with its own navigation and a landing
      page, is a Phase 2 question, because that is where the admin UI lives.
    -->
    <nav class="mt-10 border-t border-border pt-6 text-sm">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Staff pages
      </h2>
      <ul class="mt-3 space-y-2">
        <li>
          <NuxtLink to="/contact/messages" class="underline underline-offset-2 hover:text-accent-foreground">
            Contact messages
          </NuxtLink>
          <span class="ml-2 text-muted-foreground">
            Everything the contact form has received
          </span>
        </li>
        <li>
          <NuxtLink to="/auth/password" class="underline underline-offset-2 hover:text-accent-foreground">
            Change password
          </NuxtLink>
          <span class="ml-2 text-muted-foreground">
            Ends every other session this account has open
          </span>
        </li>
      </ul>
    </nav>
  </div>
</template>
