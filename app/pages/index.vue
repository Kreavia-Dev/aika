<script setup lang="ts">
/**
 * The home page.
 *
 * Placeholder copy, but deliberately honest rather than pretending to be a
 * fictional agency. This repository ships as its own example, so the page says
 * what the reader is looking at and where to read the source. A page that claims
 * to be "Meridian Studio" leaves everyone guessing.
 *
 * Note what this page does not do: it used to fetch `/api/health` to prove the
 * Nuxt to Nitro to Hono to SQLite loop. That job belongs to `/health` now, which
 * reads from the database and is the page to open when confirming a deployment
 * is wired correctly.
 */
import { site } from '~/site'

usePageSeo({
  title: 'Home',
  description: 'Aika is a starter kit for client web apps: Nuxt, Hono, and SQLite, built by feature rather than by layer, and distributed by git merge.',
})

const sections = [
  {
    title: 'Static pages',
    body: 'Open app/pages/about.vue. It is the smallest page Aika allows: one file, one title, some markup. No feature, no API, and no database.',
  },
  {
    title: 'Feature pages',
    body: 'The page at /health comes from features/health/web/pages/. A slice can own its own screens without the application knowing about it.',
  },
  {
    title: 'Sessions',
    body: 'The page at /health also requires a sign in. The guard, the password hashing, and the session table all live in features/auth/.',
  },
]
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-16 sm:py-24">
    <h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      {{ site.tagline }}
    </h1>

    <p class="mt-6 max-w-2xl text-lg text-muted-foreground">
      This is not a client project. It is the example kept inside Aika itself,
      and it is shaped like a real small site: a header, three pages, a footer,
      and a sign in. Read the source in the order below and the rest of Aika
      stops being abstract.
    </p>

    <div class="mt-8">
      <NuxtLink
        to="/about"
        class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        How this is put together
      </NuxtLink>
    </div>

    <section class="mt-20 sm:mt-28">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        What is here
      </h2>

      <ul class="mt-6 grid gap-8 sm:grid-cols-3">
        <li v-for="section in sections" :key="section.title">
          <h3 class="font-medium">
            {{ section.title }}
          </h3>
          <p class="mt-2 text-sm text-muted-foreground">
            {{ section.body }}
          </p>
        </li>
      </ul>
    </section>

    <section class="mt-20 border-t border-border pt-10 sm:mt-28">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Start here
      </h2>
      <p class="mt-4 max-w-2xl text-muted-foreground">
        <span class="font-mono text-sm text-foreground">app/site.ts</span> holds
        everything about this site: the name in the header and the browser tab, the
        tagline above, the navigation, the contact details, and the small mark in
        the corner. Change that one file and reload. Nothing else needs touching.
      </p>
    </section>
  </div>
</template>
