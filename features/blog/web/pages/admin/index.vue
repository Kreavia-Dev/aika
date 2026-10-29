<script setup lang="ts">
/**
 * The staff post list. Served at /blog/admin.
 *
 * Both roles see this. Writing a draft is content work, and the only thing an
 * editor cannot do is publish, which the list shows rather than hides: a disabled
 * button with a reason teaches more than a button that is absent.
 */
import type { StaffPostListResponse } from '../index'

useHead({
  title: 'Blog posts',
  // Tooling rather than content. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

definePageMeta({ middleware: 'auth' })

const { data, error, refresh } = await useFetch<StaffPostListResponse>('/api/blog/admin/posts')

const posts = computed(() => data.value?.data.posts ?? [])

const deleting = ref<string | null>(null)

async function remove(id: string, title: string): Promise<void> {
  // A confirm is ugly and it is the only thing standing between a misclick and a
  // client's published article.
  if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return

  deleting.value = id
  try {
    await $fetch(`/api/blog/admin/posts/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    deleting.value = null
  }
}

function formatDate(iso: string | null): string {
  return iso === null ? 'not published' : new Date(iso).toISOString().slice(0, 10)
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-16">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Blog posts
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Drafts are visible to staff only. Publishing needs an administrator.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <NuxtLink
          to="/blog/admin/categories"
          class="rounded-md border border-line-strong px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Categories
        </NuxtLink>

        <NuxtLink
          to="/blog/admin/new"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          New post
        </NuxtLink>
      </div>
    </div>

    <p v-if="error" class="mt-8 rounded-md border-l-2 border-destructive bg-muted px-4 py-3 text-sm">
      Could not load the posts. Try reloading the page.
    </p>

    <p v-else-if="posts.length === 0" class="mt-12 text-sm text-muted-foreground">
      No posts yet. The first one is the one that makes this a blog.
    </p>

    <table v-else class="mt-10 w-full text-left text-sm">
      <thead class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="py-3 font-medium">Title</th>
          <th class="py-3 font-medium">Status</th>
          <th class="py-3 font-medium">Published</th>
          <th class="py-3" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="post in posts" :key="post.id" class="border-b border-border">
          <td class="py-3 pr-4">
            <NuxtLink :to="`/blog/admin/${post.id}`" class="font-medium hover:text-primary">
              {{ post.title }}
            </NuxtLink>
            <p class="mt-0.5 font-mono text-xs text-muted-foreground">
              /blog/{{ post.slug }}
            </p>
          </td>
          <td class="py-3 pr-4">
            <span
              class="rounded-full px-2 py-0.5 text-xs"
              :class="post.status === 'published'
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground'"
            >
              {{ post.status }}
            </span>
          </td>
          <td class="py-3 pr-4 text-muted-foreground">
            {{ formatDate(post.publishedAt) }}
          </td>
          <td class="py-3 text-right">
            <NuxtLink :to="`/blog/admin/${post.id}`" class="text-muted-foreground hover:text-foreground">
              Edit
            </NuxtLink>
            <button
              type="button"
              class="ml-4 text-muted-foreground hover:text-destructive disabled:opacity-50"
              :disabled="deleting === post.id"
              @click="remove(post.id, post.title)"
            >
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
