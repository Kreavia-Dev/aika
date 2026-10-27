<script setup lang="ts">
/**
 * The contact page.
 *
 * Right now this page shows details and links out to email. The next rung adds a
 * form here that writes to the database, which is where this page stops being
 * static and starts exercising the whole stack: a migration, a contract, a POST
 * route, Zod validation, and somewhere to show the error when validation fails.
 *
 * The details come from `app/site.ts`.
 */
import { site } from '~/site'

useHead({ title: 'Contact' })

const details = [
  { label: 'Email', value: site.contact.email, href: `mailto:${site.contact.email}` },
  { label: 'Phone', value: site.contact.phone, href: `tel:${site.contact.phone.replace(/\s/g, '')}` },
  { label: 'Address', value: site.contact.address, href: null },
]
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-16 sm:py-24">
    <h1 class="text-3xl font-semibold tracking-tight">
      Contact
    </h1>

    <p class="mt-6 text-muted-foreground">
      In a client project this page becomes the contact form, and it is the best
      single example of how a page talks to the database. Until the form exists,
      the details below are how to reach the people who maintain this.
    </p>

    <dl class="mt-12 divide-y divide-border border-y border-border">
      <div v-for="detail in details" :key="detail.label" class="flex flex-wrap gap-x-6 gap-y-1 py-4">
        <dt class="w-24 shrink-0 text-sm text-muted-foreground">
          {{ detail.label }}
        </dt>
        <dd>
          <a
            v-if="detail.href"
            :href="detail.href"
            class="underline underline-offset-2 hover:text-accent-foreground"
          >
            {{ detail.value }}
          </a>
          <span v-else>{{ detail.value }}</span>
        </dd>
      </div>
    </dl>

    <p class="mt-12 border-t border-border pt-8 text-sm text-muted-foreground">
      These values live in
      <span class="font-mono text-xs text-foreground">app/site.ts</span>, not in
      this page.
    </p>
  </div>
</template>
