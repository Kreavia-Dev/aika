<script setup lang="ts">
/**
 * Editing an existing post. Served at /blog/admin/<id>.
 *
 * The id is in the path rather than the slug, because the slug is the one field
 * an author is allowed to change without the address becoming a different record.
 */
import type { StaffPostResponse } from '../../index'
import PostEditor from '../../components/PostEditor.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

const { data, error } = await useFetch<StaffPostResponse>(
  computed(() => `/api/blog/admin/posts/${encodeURIComponent(id.value)}`),
)

useHead({
  title: data.value === null ? 'Edit post' : `Edit: ${data.value.data.post.title}`,
  // Tooling rather than content. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

if (error.value !== null) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}
</script>

<template>
  <PostEditor v-if="data !== null" :post="data.data.post" />
</template>
