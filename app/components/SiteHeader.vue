<script setup lang="ts">
/**
 * The site header.
 *
 * Navigation comes from `app/site.ts`, so adding a page is one entry there plus
 * one file in `app/pages/`. Components in `app/components/` are auto imported by
 * Nuxt, so no page has to import this one.
 */
import { site } from '~/site'

const route = useRoute()

/** Home is only current on exactly `/`, so it does not light up everywhere. */
function isCurrent(path: string): boolean {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<template>
  <header class="border-b border-border bg-card">
    <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-4">
      <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
        {{ site.name }}
      </NuxtLink>

      <nav class="flex items-center gap-6 text-sm">
        <NuxtLink
          v-for="item in site.nav"
          :key="item.path"
          :to="item.path"
          class="transition-colors"
          :class="isCurrent(item.path)
            ? 'font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
