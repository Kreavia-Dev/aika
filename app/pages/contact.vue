<script setup lang="ts">
/**
 * The contact page.
 *
 * Read this file together with `features/contact/`, because together they show
 * the split the feature makes:
 *
 *   This page, and the form in `app/components/ContactForm.vue`, are the
 *   CLIENT's: the heading, the introduction, the ordering, the contact details,
 *   and the wording of the form itself. Every client words this differently, so
 *   it lives where the client's work lives.
 *
 *   `features/contact/` is the FEATURE's, and it is entirely plumbing: the table,
 *   the rules, the endpoint, and the types this page sends and receives. A fix
 *   there reaches every client through an upstream merge.
 *
 * If the copy below lived inside the feature, every upstream change to the form
 * would collide with every client's text, and every client would hit that
 * conflict. That is the whole reason for the split.
 */
import { site } from '~/site'

usePageSeo({
  title: 'Contact',
  description: 'Send a message to Aika. It is stored in the database, and read by staff on a page that requires a sign in.',
})

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
      Send a message and it is stored in the database, then read by staff on a
      page that requires a sign in. This is the one page in the example that
      exercises the whole stack: a migration, a contract, a POST route,
      validation, the response envelope, and somewhere to show the error when a
      rule rejects the input.
    </p>

    <ContactForm class="mt-10" submit-label="Send message" />

    <dl class="mt-14 divide-y divide-border border-y border-border">
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

    <p class="mt-10 text-sm text-muted-foreground">
      The form comes from
      <span class="font-mono text-xs text-foreground">features/contact/</span>.
      The words on this page come from
      <span class="font-mono text-xs text-foreground">app/site.ts</span> and this
      file, which belong to the client.
    </p>
  </div>
</template>
