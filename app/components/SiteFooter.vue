<script setup lang="ts">
import { site } from '~/site'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-border">
    <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-8 text-sm text-muted-foreground">
      <p>{{ site.name }} &copy; {{ year }}</p>

      <nav class="flex items-center gap-6">
        <a :href="`mailto:${site.contact.email}`" class="hover:text-foreground">
          {{ site.contact.email }}
        </a>

        <!--
          The operations page is guarded, so this sends a signed out visitor to
          the sign in form and a signed in one straight to the status panel.
          It is in the footer because it is for staff, not for visitors.
        -->
        <NuxtLink to="/health" class="hover:text-foreground">
          Staff
        </NuxtLink>
      </nav>
    </div>
  </footer>
</template>
