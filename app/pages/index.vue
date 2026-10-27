<script setup lang="ts">
/**
 * The home page.
 *
 * Placeholder copy, written to look like a real small business site so the
 * structure is visible rather than described. Replace it with the client's.
 *
 * Note what this page no longer does: it used to fetch `/api/health` to prove the
 * Nuxt to Nitro to Hono to SQLite loop. That job belongs to `/health`, which
 * reads from the database and is the page to open when you want to confirm a
 * deployment is wired correctly. A client home page should not be a status panel.
 */
import { site } from '~/site'

useHead({ title: 'Home' })

const services = [
  {
    title: 'Websites',
    body: 'Fast, accessible sites built to be edited by the people who own them.',
  },
  {
    title: 'Web apps',
    body: 'Dashboards, booking systems, and internal tools that fit how you already work.',
  },
  {
    title: 'Care',
    body: 'Hosting, backups, and small changes, handled without a support ticket.',
  },
]
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-16 sm:py-24">
    <h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      {{ site.tagline }}
    </h1>

    <p class="mt-6 max-w-2xl text-lg text-muted-foreground">
      We build the unglamorous part well: pages that load quickly, forms that
      actually reach someone, and a site your team can update without calling us.
    </p>

    <div class="mt-8">
      <NuxtLink
        to="/contact"
        class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Start a project
      </NuxtLink>
    </div>

    <section class="mt-20 sm:mt-28">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        What we do
      </h2>

      <ul class="mt-6 grid gap-8 sm:grid-cols-3">
        <li v-for="service in services" :key="service.title">
          <h3 class="font-medium">
            {{ service.title }}
          </h3>
          <p class="mt-2 text-sm text-muted-foreground">
            {{ service.body }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>
