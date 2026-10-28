<script setup lang="ts">
/**
 * The post editor, shared by "new" and "edit".
 *
 * WHY ONE COMPONENT FOR BOTH. The two screens differ only in where the initial
 * values come from and which method they send. Two copies would be two chances
 * for the validation message, the slug hint, and the publish rule to drift apart,
 * and the publish rule is the one that decides whether an editor can put words in
 * front of the public.
 *
 * The public preview is not here on purpose. Rendering Markdown in the browser
 * would mean a second renderer, in the browser, disagreeing with the server's,
 * and the one that matters is the one the reader sees.
 */
import type {
  Category,
  CategoryListResponse,
  PostInput,
  PostStatus,
  StaffPost,
  StaffPostResponse,
} from '../index'
import { messageFromApiError } from '~~/shared/http/error-message'

const props = defineProps<{
  /** Absent when creating. Present when editing, which is what chooses PUT. */
  post?: StaffPost | null
}>()

/*
 * NO `definePageMeta` AND NO `useHead` HERE, AND THAT IS DELIBERATE.
 *
 * This is a component, not a page. `definePageMeta` is a compiler macro that only
 * applies inside a page's `<script setup>`, and calling it in a component does
 * nothing except emit a build warning, which is how this file was found. The
 * auth middleware belongs on `pages/admin/new.vue` and `pages/admin/[id].vue`,
 * and both declare it themselves. A component that looked like it enforced
 * something and did not is worse than one that says nothing.
 *
 * The same applies to the title: both pages set their own, because only they know
 * whether this is a new post or an edited one.
 */

const { data: categoryData } = await useFetch<CategoryListResponse>('/api/blog/categories')
const categories = computed<Category[]>(() => categoryData.value?.data.categories ?? [])

const form = reactive({
  slug: props.post?.slug ?? '',
  title: props.post?.title ?? '',
  summary: props.post?.summary ?? '',
  body: props.post?.body ?? '',
  categoryId: props.post?.categoryId ?? '',
  status: (props.post?.status ?? 'draft') as PostStatus,
})

const submitting = ref(false)
const errorText = ref<string | null>(null)
const successMessage = ref<string | null>(null)

/**
 * A slug suggested from the title, while the slug is still untouched.
 *
 * Stops suggesting the moment somebody edits the slug by hand, because overwriting
 * a deliberate choice every time they fix a typo in the title is the behaviour
 * people complain about.
 */
const slugTouched = ref(props.post != null)

watch(() => form.title, (title) => {
  if (slugTouched.value) return

  form.slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
})

function onSlugInput(): void {
  slugTouched.value = true
}

async function submit(): Promise<void> {
  submitting.value = true
  errorText.value = null
  successMessage.value = null

  const payload: PostInput = {
    slug: form.slug,
    title: form.title,
    summary: form.summary,
    body: form.body,
    categoryId: form.categoryId === '' ? null : form.categoryId,
    status: form.status,
  }

  try {
    const response = props.post == null
      ? await $fetch<StaffPostResponse>('/api/blog/admin/posts', { method: 'POST', body: payload })
      : await $fetch<StaffPostResponse>(`/api/blog/admin/posts/${props.post.id}`, { method: 'PUT', body: payload })

    successMessage.value = response.message

    // A new post becomes an edit screen, so a second save does not try to create
    // the same slug again.
    if (props.post == null) {
      await navigateTo(`/blog/admin/${response.data.post.id}`)
    }
  }
  catch (error) {
    errorText.value = messageFromApiError(error, 'Could not save the post. Please try again.')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="mx-auto max-w-3xl px-6 py-16" @submit.prevent="submit">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ post == null ? 'New post' : 'Edit post' }}
      </h1>

      <NuxtLink to="/blog/admin" class="text-sm text-muted-foreground hover:text-foreground">
        All posts
      </NuxtLink>
    </div>

    <div class="mt-10 space-y-6">
      <div>
        <label for="title" class="mb-1.5 block text-sm font-medium">Title</label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          required
          maxlength="200"
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-lg outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <div>
        <label for="slug" class="mb-1.5 block text-sm font-medium">Address</label>
        <div class="flex items-center gap-1 text-sm">
          <span class="text-muted-foreground">/blog/</span>
          <input
            id="slug"
            v-model="form.slug"
            type="text"
            required
            maxlength="120"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            class="flex-1 rounded-md border border-line-strong bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            @input="onSlugInput"
          >
        </div>
        <p class="mt-1.5 text-xs text-muted-foreground">
          Lowercase letters, digits, and single hyphens. Changing it after publishing breaks any link anybody saved.
        </p>
      </div>

      <div>
        <label for="summary" class="mb-1.5 block text-sm font-medium">Summary</label>
        <textarea
          id="summary"
          v-model="form.summary"
          rows="2"
          required
          maxlength="320"
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
        <p class="mt-1.5 text-xs text-muted-foreground">
          Shows in the list, and becomes the description in a search result. At least 20 characters.
        </p>
      </div>

      <div>
        <label for="body" class="mb-1.5 block text-sm font-medium">Body</label>
        <textarea
          id="body"
          v-model="form.body"
          rows="18"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
        <p class="mt-1.5 text-xs text-muted-foreground">
          Markdown: <code class="font-mono"># heading</code>,
          <code class="font-mono">**bold**</code>,
          <code class="font-mono">[link](https://example.com)</code>,
          <code class="font-mono">- list</code>,
          <code class="font-mono">&gt; quote</code>.
          Raw HTML is shown as text rather than interpreted.
        </p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <label for="category" class="mb-1.5 block text-sm font-medium">Category</label>
          <select
            id="category"
            v-model="form.categoryId"
            class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
            <option value="">No category</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <p v-if="categories.length === 0" class="mt-1.5 text-xs text-muted-foreground">
            No categories exist yet. An administrator can add one with
            <code class="font-mono">POST /api/blog/admin/categories</code>.
          </p>
        </div>

        <div>
          <label for="status" class="mb-1.5 block text-sm font-medium">Status</label>
          <select
            id="status"
            v-model="form.status"
            class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
            <option value="draft">Draft, visible to staff only</option>
            <option value="published">Published, visible to everybody</option>
          </select>
          <p class="mt-1.5 text-xs text-muted-foreground">
            Publishing needs an administrator. An editor can save this as a draft and ask one to publish it.
          </p>
        </div>
      </div>
    </div>

    <p v-if="successMessage" role="status" class="mt-8 rounded-md border-l-2 border-success bg-muted px-4 py-3 text-sm">
      {{ successMessage }}
    </p>

    <p v-if="errorText" role="alert" class="mt-8 rounded-md border-l-2 border-destructive bg-muted px-4 py-3 text-sm">
      {{ errorText }}
    </p>

    <div class="mt-10 flex items-center gap-4">
      <button
        type="submit"
        :disabled="submitting"
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {{ submitting ? 'Saving...' : (post == null ? 'Create post' : 'Save changes') }}
      </button>

      <NuxtLink
        v-if="post != null && post.status === 'published'"
        :to="`/blog/${post.slug}`"
        target="_blank"
        class="text-sm text-muted-foreground hover:text-foreground"
      >
        View it
      </NuxtLink>
    </div>
  </form>
</template>
