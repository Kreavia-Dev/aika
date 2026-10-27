<script setup lang="ts">
/**
 * The about page.
 *
 * Placeholder copy. This is the page to look at to see the smallest possible
 * page in Aika: a file in `app/pages/`, a title, and some markup. No feature, no
 * API, no database.
 */
import { site } from '~/site'

useHead({ title: 'About' })

const facts = [
  { label: 'Founded', value: '2019' },
  { label: 'People', value: 'Six' },
  { label: 'Based in', value: site.contact.address },
]
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-16 sm:py-24">
    <h1 class="text-3xl font-semibold tracking-tight">
      About us
    </h1>

    <div class="mt-6 space-y-4 text-muted-foreground">
      <p>
        We are a small studio, and we intend to stay small. Every project is
        handled by the people who will still be here when you need a change made
        two years from now.
      </p>
      <p>
        Most of our work replaces a site that became impossible to update. We
        start by looking at how your team actually works today, then build
        something that fits that, rather than asking your team to fit the tool.
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
  </div>
</template>
