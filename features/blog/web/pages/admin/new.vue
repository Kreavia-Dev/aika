<script setup lang="ts">
/**
 * A new post. Served at /blog/admin/new.
 *
 * The form itself lives in `../components/PostEditor.vue` and is shared with the
 * edit screen, so the two cannot drift apart in what they accept.
 */
import PostEditor from '../../components/PostEditor.vue'

useHead({
  title: 'New post',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

definePageMeta({ middleware: 'auth' })
</script>

<template>
  <PostEditor />
</template>
