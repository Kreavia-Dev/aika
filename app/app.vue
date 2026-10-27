<script setup lang="ts">
/**
 * The application root.
 *
 * WHY `<NuxtLayout>` IS NOT OPTIONAL HERE. Without this wrapper, Nuxt renders
 * each page and silently ignores every layout. A page that sets
 * `definePageMeta({ layout: 'something' })` simply does not get it, with no
 * warning at all, which is the kind of failure that costs somebody an afternoon.
 *
 * That was the state of this file until the site layout was built, and it is why
 * it is worth saying out loud: `app/layouts/` only does anything if this file
 * asks for it.
 *
 * With the wrapper, `app/layouts/default.vue` surrounds every page, and a page
 * opts out with `definePageMeta({ layout: false })`, as the sign in page does.
 */
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
