<script setup lang="ts">
/**
 * The media library, at /media.
 *
 * Reached only when signed in, and kept out of search results.
 *
 * WHY THIS PAGE IS AT `/media` AND NOT AT `/media/library`. Uploaded files are
 * served at `/media/<filename>` by a Nitro route, and a Nitro route is matched
 * before a page. A page at `/media/library` would therefore never render: the
 * file route claims the path first and looks for a file called `library`.
 *
 * That was the first version of this feature. It returned 404 with a valid
 * session, and the cause was not the guard or the page registration. The fix is
 * to give the page the bare parent path rather than to move the files to
 * uglier URLs, because the file URLs are what end up inside a client's content.
 */
import { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from '../../contract'
import type { MediaListResponse, MediaUploadResponse } from '../../contract'

definePageMeta({ middleware: 'auth' })

useHead({
  title: 'Media',
  // Tooling rather than content. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { data, refresh } = await useFetch<MediaListResponse>('/api/media')

const chosen = ref<File | null>(null)
const busy = ref(false)
const problem = ref<string | null>(null)
const accepted = ALLOWED_IMAGE_TYPES.map(entry => entry.contentType).join(',')
const limitMb = Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)

/**
 * Checked here as well as on the server, so somebody dragging in a huge file is
 * told immediately instead of after a long upload. The server check is the one
 * that counts; this one is courtesy.
 */
function choose(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  problem.value = null

  if (file && file.size > MAX_UPLOAD_BYTES) {
    problem.value = `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${limitMb} MB.`
    chosen.value = null
    input.value = ''
    return
  }

  chosen.value = file
}

async function upload(): Promise<void> {
  if (!chosen.value) return

  busy.value = true
  problem.value = null

  try {
    const body = new FormData()
    body.append('file', chosen.value)
    await $fetch<MediaUploadResponse>('/api/media', { method: 'POST', body })
    chosen.value = null
    await refresh()
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'The upload did not complete.'
  } finally {
    busy.value = false
  }
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-16">
    <h1 class="text-3xl font-semibold tracking-tight">Media</h1>
    <p class="mt-3 text-muted-foreground">
      Files uploaded here can be linked from anywhere on the site. Images only,
      up to {{ limitMb }} MB each.
    </p>

    <form class="mt-10 rounded-md border border-border bg-card p-6" @submit.prevent="upload">
      <label class="block text-sm font-medium" for="media-file">Choose a file</label>
      <input
        id="media-file"
        class="mt-3 block w-full text-sm"
        type="file"
        :accept="accepted"
        @change="choose"
      >

      <p v-if="chosen" class="mt-3 text-sm text-muted-foreground">
        {{ chosen.name }} ({{ readableSize(chosen.size) }})
      </p>

      <p v-if="problem" class="mt-3 text-sm text-destructive">{{ problem }}</p>

      <button
        type="submit"
        class="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        :disabled="busy || !chosen"
      >
        {{ busy ? 'Uploading' : 'Upload' }}
      </button>
    </form>

    <h2 class="mt-14 text-lg font-semibold">Uploaded files</h2>

    <p v-if="!data?.data.files.length" class="mt-4 text-sm text-muted-foreground">
      Nothing here yet.
    </p>

    <ul v-else class="mt-4 divide-y divide-border rounded-md border border-border">
      <li
        v-for="file in data.data.files"
        :key="file.id"
        class="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 text-sm"
      >
        <img
          class="h-12 w-12 rounded border border-border object-cover"
          :src="file.url"
          :alt="file.originalName"
        >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">{{ file.originalName }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ file.contentType }} · {{ readableSize(file.byteSize) }}
          </span>
        </span>
        <code class="text-xs text-muted-foreground">{{ file.url }}</code>
      </li>
    </ul>
  </div>
</template>
