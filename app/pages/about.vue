<script setup lang="ts">
/**
 * The about page.
 *
 * Also the answer to "where do I start reading". The facts below describe the
 * approach rather than counting things, because a page that says "62 tests"
 * becomes a lie the first time somebody adds a test.
 */
import { site } from '~/site'

usePageSeo({
  title: 'About',
  description: 'What Aika is, who it is for, and the handful of decisions that shape everything built with it.',
})

const facts = [
  { label: 'Runtime', value: 'One Node process' },
  { label: 'Database', value: 'SQLite in WAL mode' },
  { label: 'Updates', value: 'git merge upstream' },
]
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-16 sm:py-24">
    <h1 class="text-3xl font-semibold tracking-tight">
      About this site
    </h1>

    <div class="mt-6 space-y-4 text-muted-foreground">
      <p>
        This page exists to be the smallest complete example in the repository. A
        page in Aika is a file in
        <span class="font-mono text-sm text-foreground">app/pages/</span>, a
        title, and some markup. Nothing else is required, and that is the point:
        the layers above are there for when a page needs them, not before.
      </p>
      <p>
        The page you are reading is owned by the client project. The pages under
        <span class="font-mono text-sm text-foreground">features/</span> are owned
        by a feature. Both end up in the same site, and Aika keeps them apart so
        that pulling an upstream change never overwrites your work.
      </p>
    </div>

    <dl class="mt-12 grid gap-6 border-t border-border pt-8 sm:grid-cols-3">
      <div v-for="fact in facts" :key="fact.label">
        <dt class="text-sm text-muted-foreground">
          {{ fact.label }}
        </dt>
        <dd class="mt-1 font-medium">
          {{ fact.value }}
        </dd>
      </div>
    </dl>

    <p class="mt-12 border-t border-border pt-8 text-sm text-muted-foreground">
      The site name, the navigation, and the contact details on these pages all
      come from
      <span class="font-mono text-xs text-foreground">app/site.ts</span>.
    </p>
  </div>
</template>
