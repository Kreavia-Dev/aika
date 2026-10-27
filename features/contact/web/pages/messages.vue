<script setup lang="ts">
/**
 * The staff inbox. Served at /contact/messages.
 *
 * WHY THIS PATH AND NOT /admin/messages. Feature pages are always mounted under
 * their feature's own name, which is what stops two features both claiming
 * `/admin` and fighting over it. So this page is `/contact/messages`. A shared
 * admin area is a Phase 2 question, and when one exists this page moves into it.
 *
 * WHY THIS PAGE IS IN THE FEATURE while `app/components/ContactForm.vue` is not.
 * The test is "will every client want the same thing here". A contact form is
 * branding, and every client words it differently. An inbox is tooling, and no
 * client wants to rewrite one.
 */
import type { ContactMessagesResponse } from '../index'

useHead({
  title: 'Contact messages',
  // Tooling rather than content. A list of a client's inbound messages must never
  // appear in a search result. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

/*
 * Staff only. The message list is everything a client's visitors have ever sent,
 * so this screen is the most sensitive page in the application after the sign in
 * form itself.
 */
definePageMeta({ middleware: 'auth' })

const { data, error } = await useFetch<ContactMessagesResponse>('/api/contact/messages')

const messages = computed(() => data.value?.data.messages ?? [])

/**
 * Reads a little like a bot, for the triage hint next to each message.
 *
 * Deliberately crude. A real detector is a Phase 3 problem, and this only claims
 * to be a hint: a person on an unusual browser can trip it, which is why the
 * wording says "looks like" rather than "is".
 */
function looksAutomated(userAgent: string | null): boolean {
  if (!userAgent) return true

  return /bot|crawl|spider|curl|wget|python|headless/i.test(userAgent)
}

/**
 * Formats a timestamp for the viewer's own clock.
 *
 * This runs on the client only, through `<ClientOnly>` in the template. Formatting
 * in the viewer's timezone during server rendering produces a different string on
 * the server than in the browser, and Vue reports that as a hydration mismatch.
 * The fallback shows a fixed UTC value, which is wrong in a way nobody will
 * misread because it says so.
 */
function localTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function utcTime(iso: string): string {
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        Contact messages
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ messages.length }} of the most recent {{ 100 }}
      </p>
    </header>

    <p class="mt-2 text-sm text-muted-foreground">
      Everything the contact form has received, newest first. This page belongs to
      the <code class="font-mono text-xs">contact</code> feature and requires a
      session.
    </p>

    <p v-if="error" class="mt-10 rounded-md border-l-2 border-destructive bg-muted px-4 py-3 text-sm">
      Could not load messages: {{ error.message }}
    </p>

    <p
      v-else-if="messages.length === 0"
      class="mt-10 rounded-md border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted-foreground"
    >
      No messages yet. Submit the form at
      <NuxtLink to="/contact" class="underline underline-offset-2">/contact</NuxtLink>
      to see one appear here.
    </p>

    <ul v-else class="mt-10 space-y-4">
      <li
        v-for="message in messages"
        :key="message.id"
        class="rounded-lg border border-border bg-card p-5"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p class="font-medium">
            {{ message.name }}
            <a
              :href="`mailto:${message.email}`"
              class="ml-2 text-sm font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {{ message.email }}
            </a>
          </p>

          <time :datetime="message.createdAt" class="text-xs text-muted-foreground tabular-nums">
            <ClientOnly>
              {{ localTime(message.createdAt) }}
              <template #fallback>{{ utcTime(message.createdAt) }}</template>
            </ClientOnly>
          </time>
        </div>

        <p class="mt-3 whitespace-pre-wrap text-sm">
          {{ message.message }}
        </p>

        <p class="mt-3 font-mono text-[11px] text-faint">
          {{ message.userAgent ?? 'no user agent' }}
          <span v-if="looksAutomated(message.userAgent)" class="ml-1 text-destructive">
            (looks automated, check before answering)
          </span>
        </p>
      </li>
    </ul>

    <p class="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
      A message sitting here notifies nobody. Until the notification exists on the
      roadmap is built, this page is only seen by somebody who opens it.
    </p>
  </div>
</template>
