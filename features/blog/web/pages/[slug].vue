<script setup lang="ts">
/**
 * A single published post. Served at /blog/<slug>.
 *
 * WHY THIS FILE IS NAMED `[slug].vue` AND NOT `posts/[slug].vue`. The feature page
 * convention mounts a feature's pages under its own name, so this file produces
 * exactly `/blog/<slug>`, which is the address a reader types and a search result
 * shows.
 *
 * WHY THE FETCH IS WRAPPED IN `catch` RATHER THAN CHECKING `error`. On the server,
 * `useFetch` rethrows a non-2xx response instead of leaving it in `error`, so an
 * `if (error.value)` check never runs during server rendering and the page dies
 * with the fetch's own error rather than the 404 this page wants. Catching it is
 * what turns an unpublished post into a clean 404 instead of a stack trace.
 *
 * WHAT RENDERS THE BODY. The server converts Markdown to HTML before sending it,
 * through `features/blog/server/markdown.ts`, which escapes its input and only
 * emits tags it constructs itself. That is why `v-html` below is acceptable here.
 */
import type { MovedResponse, PostResponse } from '../index'
import { usePageSeo } from '../seo'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

/*
 * A renamed post is a redirect, not a 404.
 *
 * WHY THIS ASKS THE MOVED ENDPOINT FIRST, AND NOT ONLY AFTER A MISS.
 *
 * MEASURED, AND THIS IS THE BUG THE FIRST VERSION HAD. The page tried the post
 * first and only asked "did this move" when that failed. But `useFetch` on the
 * server follows redirects: the API's 301 was followed by the server to the new
 * address, the body arrived with a different slug than the one asked for, and the
 * page rendered the article at the OLD url with a 200. Clearing that up by
 * comparing slugs is guesswork. Asking first is not: one request answers whether
 * the address moved, and only if it did not does the page fetch the article.
 *
 * The cost is one extra tiny request per article page view. The cost of the other
 * order was an article reachable at two addresses with two canonical URLs, which
 * is worse for a blog than one request.
 */
const moved = await useFetch<MovedResponse>(
  computed(() => `/api/blog/moved/${encodeURIComponent(slug.value)}`),
).catch(() => null)

const movedTo = moved?.data.value?.data.movedTo ?? null

/*
 * `redirectCode: 301` so the browser and a search engine both remember it. The
 * page is never rendered at the old address, which is the point: there is one
 * address for an article and it is the current one.
 */
if (movedTo !== null) {
  await navigateTo(`/blog/${movedTo}`, { redirectCode: 301, replace: true })
}

const fetched = await useFetch<PostResponse>(
  computed(() => `/api/blog/posts/${encodeURIComponent(slug.value)}`),
).catch(() => null)

const post = fetched?.data.value?.data.post ?? null

/*
 * A missing or unpublished post is a 404, not an empty page.
 *
 * Thrown during server rendering, so a crawler and a link checker see the status
 * rather than a 200 with a polite message in it.
 */
if (post === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

usePageSeo({
  title: post.title,
  description: post.summary,
})

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}
</script>

<template>
  <article v-if="post !== null" class="mx-auto max-w-3xl px-6 py-16">
    <p class="text-xs text-muted-foreground">
      <time :datetime="post.publishedAt">{{ formatDate(post.publishedAt) }}</time>
      <span v-if="post.category !== null">
        ·
        <NuxtLink :to="`/blog?category=${post.category.slug}`" class="hover:text-foreground">
          {{ post.category.name }}
        </NuxtLink>
      </span>
    </p>

    <h1 class="mt-3 text-3xl font-semibold tracking-tight">
      {{ post.title }}
    </h1>

    <p class="mt-4 text-lg text-muted-foreground">
      {{ post.summary }}
    </p>

    <img
      v-if="post.coverUrl !== null"
      :src="post.coverUrl"
      alt=""
      class="mt-8 aspect-video w-full rounded-lg border border-border object-cover"
    >

    <!-- Safe: the body is HTML the server constructed from escaped Markdown. -->
    <div class="blog-body mt-10" v-html="post.bodyHtml" />

    <p class="mt-12 border-t border-border pt-6 text-sm">
      <NuxtLink to="/blog" class="text-muted-foreground hover:text-foreground">
        All posts
      </NuxtLink>
    </p>
  </article>
</template>
