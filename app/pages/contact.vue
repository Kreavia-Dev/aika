<script setup lang="ts">
/**
 * The contact page.
 *
 * Right now this page shows details and links out to email. The next rung adds a
 * form here that writes to the database, which is where this page stops being
 * static and starts exercising the whole stack.
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
      Tell us what you need and what is in the way. If we are not the right
      studio for it, we will say so and point you at someone who is.
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
  </div>
</template>
