<script setup lang="ts">
/**
 * The small mark in the corner of every page.
 *
 * Fixed rather than sitting in the footer, so it stays visible while scrolling.
 * Three deliberate details:
 *
 *   `pointer-events-none` so it can never swallow a click on something beneath it.
 *   `aria-hidden` so a screen reader is not told about decoration.
 *   `print:hidden` so it does not end up on a printed page.
 *
 * Controlled by `site.watermark` in `app/site.ts`. Turning it off there is the
 * supported way; deleting this component is not, because an upstream change
 * would bring it back and the client would not know why.
 */
import { site } from '~/site'
</script>

<template>
  <div
    v-if="site.watermark.show"
    class="pointer-events-none fixed bottom-4 right-4 z-50 select-none print:hidden"
    aria-hidden="true"
  >
    <span class="rounded border border-border bg-card/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-faint backdrop-blur-sm">
      {{ site.watermark.text }}
    </span>
  </div>
</template>
