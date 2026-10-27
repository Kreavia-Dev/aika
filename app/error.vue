<script setup lang="ts">
/**
 * The page shown when a route does not exist, or a request failed.
 *
 * Nuxt renders this instead of the normal page tree, so it stands in for
 * everything: a visitor who mistyped a URL sees this and nothing else. That is
 * why it keeps the site chrome, through the layout, rather than being a bare
 * message on a white page. Somebody who lands here needs a way out, and the header
 * is the way out.
 *
 * WHY THE ERROR MESSAGE IS HIDDEN IN PRODUCTION. `error.message` from a thrown
 * error can contain a file path, a SQL fragment, or a stack frame's worth of
 * internal naming. In development that is exactly what you want to see. On a
 * client's live site it is a gift to anybody probing.
 *
 * IF YOU TEST THIS WITH CURL AND SEE JSON, NOTHING IS BROKEN. Nitro
 * content-negotiates its own error handler, so a client that does not ask for
 * HTML gets a JSON error object instead of this page. A browser sends
 * `Accept: text/html` and gets this page. Reproduce it with
 * `curl -H 'Accept: text/html' http://localhost:5555/no-such-page`.
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error.statusCode === 404)

useHead({
  title: isNotFound.value ? 'Page not found' : 'Something went wrong',
  /*
   * An error page must never be indexed. A search result pointing at a 404 is
   * both useless to the person clicking it and a signal of a badly maintained
   * site.
   */
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const showDetail = computed(() => import.meta.dev && Boolean(props.error.message))

function goHome(): void {
  // Clears the error state before navigating, which a plain link would not.
  clearError({ redirect: '/' })
}
</script>

<template>
  <NuxtLayout>
    <div class="mx-auto max-w-2xl px-6 py-20 sm:py-28">
      <p class="font-mono text-sm text-muted-foreground">
        {{ error.statusCode }}
      </p>

      <h1 class="mt-4 text-3xl font-semibold tracking-tight">
        {{ isNotFound ? 'That page does not exist.' : 'Something went wrong on our side.' }}
      </h1>

      <p class="mt-6 text-muted-foreground">
        <template v-if="isNotFound">
          The address you followed is not one this site serves. It may have been
          mistyped, or it may be a page that used to exist and no longer does.
        </template>
        <template v-else>
          This one is not your fault, and it has been logged on our side. Trying
          again in a moment is usually enough.
        </template>
      </p>

      <p v-if="showDetail" class="mt-8 rounded-md border border-border bg-muted px-4 py-3 font-mono text-xs">
        {{ error.message }}
      </p>

      <div class="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          @click="goHome"
        >
          Go to the home page
        </button>
        <NuxtLink
          to="/contact"
          class="inline-flex items-center rounded-md border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Tell us about it
        </NuxtLink>
      </div>
    </div>
  </NuxtLayout>
</template>
