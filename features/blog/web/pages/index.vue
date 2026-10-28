<script setup lang="ts">
/**
 * The public blog list. Served at /blog.
 *
 * Server rendered, because this is a page a search engine reads and a link
 * previews, and both of those want the posts in the HTML rather than fetched
 * afterwards by a browser.
 *
 * WHY `useHead` AND NOT `usePageSeo`. That composable lives in `app/` and reads
 * `app/site.ts`, and a feature may not import from `app/` (rule R3). Every other
 * feature page here is tooling and declares `noindex` instead. This one is public
 * content, so it sets its own description and canonical from the route it already
 * knows, which is the minimum a reader deserves rather than the maximum.
 */
import type { CategoryListResponse, PostListResponse } from '../index'
import { usePageSeo } from '../seo'
const route = useRoute()

const page = computed(() => {
  const raw = Number(route.query.page ?? '1')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
})

const categorySlug = computed(() => typeof route.query.category === 'string' ? route.query.category : undefined)

const { data: postData } = await useFetch<PostListResponse>('/api/blog/posts', {
  query: computed(() => ({
    page: page.value,
    ...(categorySlug.value === undefined ? {} : { category: categorySlug.value }),
  })),
})

const { data: categoryData } = await useFetch<CategoryListResponse>('/api/blog/categories')

const posts = computed(() => postData.value?.data.posts ?? [])
const hasMore = computed(() => postData.value?.data.hasMore ?? false)
const categories = computed(() => categoryData.value?.data.categories ?? [])

const activeCategory = computed(
  () => categories.value.find(category => category.slug === categorySlug.value) ?? null,
)

usePageSeo({
  title: activeCategory.value === null ? 'Blog' : `Blog: ${activeCategory.value.name}`,
  description: activeCategory.value === null
    ? 'Articles and notes, newest first.'
    : `Articles filed under ${activeCategory.value.name}, newest first.`,
})

/** Keeps the category filter when paging, which is otherwise easy to lose. */
function pageLink(target: number): string {
  const query = new URLSearchParams()
  if (categorySlug.value !== undefined) query.set('category', categorySlug.value)
  if (target > 1) query.set('page', String(target))
  const suffix = query.toString()
  return suffix === '' ? '/blog' : `/blog?${suffix}`
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="text-3xl font-semibold tracking-tight">
      Blog
    </h1>

    <nav v-if="categories.length > 0" class="mt-6 flex flex-wrap gap-2 text-sm">
      <NuxtLink
        to="/blog"
        class="rounded-full border px-3 py-1 transition-colors"
        :class="activeCategory === null
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:text-foreground'"
      >
        All
      </NuxtLink>
      <NuxtLink
        v-for="category in categories"
        :key="category.id"
        :to="`/blog?category=${category.slug}`"
        class="rounded-full border px-3 py-1 transition-colors"
        :class="activeCategory?.slug === category.slug
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:text-foreground'"
      >
        {{ category.name }}
      </NuxtLink>
    </nav>

    <p v-if="posts.length === 0" class="mt-12 text-muted-foreground">
      Nothing published here yet.
    </p>

    <ul v-else class="mt-12 space-y-10">
      <li v-for="post in posts" :key="post.slug">
        <article>
          <NuxtLink :to="`/blog/${post.slug}`" class="group block">
            <img
              v-if="post.coverUrl !== null"
              :src="post.coverUrl"
              :alt="``"
              class="mb-4 aspect-video w-full rounded-lg border border-border object-cover"
              loading="lazy"
            >
            <p class="text-xs text-muted-foreground">
              <time :datetime="post.publishedAt">{{ formatDate(post.publishedAt) }}</time>
              <span v-if="post.category !== null"> · {{ post.category.name }}</span>
            </p>
            <h2 class="mt-2 text-xl font-semibold tracking-tight group-hover:text-primary">
              {{ post.title }}
            </h2>
            <p class="mt-2 text-sm text-muted-foreground">
              {{ post.summary }}
            </p>
          </NuxtLink>
        </article>
      </li>
    </ul>

    <nav v-if="page > 1 || hasMore" class="mt-12 flex items-center justify-between border-t border-border pt-6 text-sm">
      <NuxtLink
        v-if="page > 1"
        :to="pageLink(page - 1)"
        class="text-muted-foreground hover:text-foreground"
      >
        Newer
      </NuxtLink>
      <span v-else />

      <NuxtLink
        v-if="hasMore"
        :to="pageLink(page + 1)"
        class="text-muted-foreground hover:text-foreground"
      >
        Older
      </NuxtLink>
    </nav>
  </div>
</template>
