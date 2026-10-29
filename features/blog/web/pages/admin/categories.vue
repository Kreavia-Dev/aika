<script setup lang="ts">
/**
 * Categories. Served at /blog/admin/categories.
 *
 * Administrator only, in the page as well as the API. A category is structure
 * rather than content, so it follows the same rule as publishing: an editor can
 * write a post and file it under an existing category, but deciding what the
 * categories are is a decision about the site, not about a piece of writing.
 */
import type { CategoryListResponse } from '../../index'
import { messageFromApiError } from '~~/shared/http/error-message'

useHead({
  title: 'Blog categories',
  // Tooling rather than content. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

definePageMeta({ middleware: ['auth', 'admin'] })

const { data, error, refresh } = await useFetch<CategoryListResponse>('/api/blog/categories')

const categories = computed(() => data.value?.data.categories ?? [])

const form = reactive({ slug: '', name: '', sortOrder: 0 })
const submitting = ref(false)
const errorText = ref<string | null>(null)
const successMessage = ref<string | null>(null)

/**
 * The slug is suggested from the name and stops the moment somebody edits it, the
 * same behaviour as the post editor. Two screens generating slugs differently
 * would be two sets of rules to remember.
 */
const slugTouched = ref(false)

watch(() => form.name, (name) => {
  if (slugTouched.value) return

  form.slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
})

async function submit(): Promise<void> {
  submitting.value = true
  errorText.value = null
  successMessage.value = null

  try {
    await $fetch('/api/blog/admin/categories', {
      method: 'POST',
      body: {
        slug: form.slug,
        name: form.name,
        sortOrder: Number(form.sortOrder) || 0,
      },
    })

    successMessage.value = `Added ${form.name}.`
    form.slug = ''
    form.name = ''
    form.sortOrder = 0
    slugTouched.value = false
    await refresh()
  }
  catch (error) {
    errorText.value = messageFromApiError(error, 'Could not add the category.')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-16">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        Blog categories
      </h1>
      <NuxtLink to="/blog/admin" class="text-sm text-muted-foreground hover:text-foreground">
        All posts
      </NuxtLink>
    </div>

    <p class="mt-2 text-sm text-muted-foreground">
      Categories group posts and give each one its own filtered list at
      <code class="font-mono text-xs">/blog?category=...</code>.
    </p>

    <p v-if="error" class="mt-8 rounded-md border-l-2 border-destructive bg-muted px-4 py-3 text-sm">
      Could not load the categories. Try reloading the page.
    </p>

    <ul v-else-if="categories.length > 0" class="mt-10 divide-y divide-border border-y border-border">
      <li v-for="category in categories" :key="category.id" class="flex items-center justify-between py-3 text-sm">
        <div>
          <p class="font-medium">
            {{ category.name }}
          </p>
          <p class="mt-0.5 font-mono text-xs text-muted-foreground">
            {{ category.slug }}
          </p>
        </div>
        <span class="text-xs text-muted-foreground">order {{ category.sortOrder }}</span>
      </li>
    </ul>

    <p v-else class="mt-10 text-sm text-muted-foreground">
      No categories yet. The form below adds the first one.
    </p>

    <form class="mt-12 border-t border-border pt-8" @submit.prevent="submit">
      <h2 class="text-lg font-semibold tracking-tight">
        Add a category
      </h2>

      <div class="mt-6 space-y-4">
        <div>
          <label for="name" class="mb-1.5 block text-sm font-medium">Name</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            maxlength="80"
            class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
        </div>

        <div>
          <label for="slug" class="mb-1.5 block text-sm font-medium">Address</label>
          <input
            id="slug"
            v-model="form.slug"
            type="text"
            required
            maxlength="120"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            class="w-full rounded-md border border-line-strong bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            @input="slugTouched = true"
          >
          <p class="mt-1.5 text-xs text-muted-foreground">
            Used in the filter URL. A category cannot be renamed to an address another one already uses.
          </p>
        </div>

        <div>
          <label for="order" class="mb-1.5 block text-sm font-medium">Order</label>
          <input
            id="order"
            v-model.number="form.sortOrder"
            type="number"
            min="0"
            max="9999"
            class="w-32 rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
          <p class="mt-1.5 text-xs text-muted-foreground">
            Lower sorts first. Ties fall back to the name.
          </p>
        </div>
      </div>

      <p v-if="successMessage" role="status" class="mt-6 rounded-md border-l-2 border-success bg-muted px-4 py-3 text-sm">
        {{ successMessage }}
      </p>

      <p v-if="errorText" role="alert" class="mt-6 rounded-md border-l-2 border-destructive bg-muted px-4 py-3 text-sm">
        {{ errorText }}
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {{ submitting ? 'Adding...' : 'Add category' }}
      </button>
    </form>
  </div>
</template>
