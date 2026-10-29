<script setup lang="ts">
/**
 * Picking a cover image for a post, using the media library that already exists.
 *
 * WHY THIS IS NOT A SECOND UPLOAD PATH. `/api/media` already validates the bytes,
 * resizes, records the file, and refuses SVG. A second upload route in the blog
 * would be a second copy of all of that, and the copy that gets fixed is never the
 * one somebody is using. So this offers two things and nothing else: pick from
 * what is already in the library, or send the visitor to `/media` to upload it
 * there first.
 *
 * WHY THE GUEST PICKER IS A SEPARATE COMPONENT RATHER THAN A MODAL IN THE FORM.
 * The editor form is already long, and a dialog inside a form is the classic way
 * to get a click that submits something.
 */
import type { MediaFile, MediaListResponse } from '~~/features/media/web'

const props = defineProps<{
  /** The currently chosen image id, or null. */
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { data, error, refresh } = await useFetch<MediaListResponse>('/api/media')

const files = computed<MediaFile[]>(() => data.value?.data.files ?? [])

const selected = computed(
  () => files.value.find(file => file.id === props.modelValue) ?? null,
)

const choosing = ref(false)

function choose(file: MediaFile): void {
  emit('update:modelValue', file.id)
  choosing.value = false
}

function clear(): void {
  emit('update:modelValue', null)
  choosing.value = false
}
</script>

<template>
  <div>
    <span class="mb-1.5 block text-sm font-medium">Cover image</span>

    <p v-if="error" class="rounded-md border-l-2 border-destructive bg-muted px-4 py-3 text-sm">
      Could not load the media library. <button type="button" class="underline" @click="refresh()">Try again</button>
    </p>

    <div v-else-if="selected !== null" class="flex items-start gap-4">
      <img
        :src="selected.url"
        :alt="``"
        class="aspect-video w-40 rounded-md border border-border object-cover"
      >
      <div class="text-sm">
        <p class="font-medium">
          {{ selected.originalName }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ Math.round(selected.byteSize / 1024) }} kB
        </p>
        <button type="button" class="mt-2 text-muted-foreground underline hover:text-foreground" @click="choosing = true">
          Change
        </button>
        <button type="button" class="mt-2 ml-4 text-muted-foreground underline hover:text-destructive" @click="clear">
          Remove
        </button>
      </div>
    </div>

    <div v-else-if="!choosing">
      <button
        type="button"
        class="rounded-md border border-line-strong px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        @click="choosing = true"
      >
        Choose an image
      </button>
      <p class="mt-1.5 text-xs text-muted-foreground">
        Images come from the media library.
      </p>
    </div>

    <div v-if="choosing" class="mt-2">
      <p v-if="files.length === 0" class="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        The media library is empty.
        <NuxtLink to="/media" target="_blank" class="underline hover:text-foreground">Upload one first</NuxtLink>,
        then come back and pick it here.
      </p>

      <template v-else>
        <div class="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-3">
          <button
            v-for="file in files"
            :key="file.id"
            type="button"
            class="group text-left"
            @click="choose(file)"
          >
            <img
              :src="file.url"
              :alt="file.originalName"
              class="aspect-video w-full rounded border object-cover transition-opacity group-hover:opacity-80"
              :class="file.id === modelValue ? 'border-primary ring-2 ring-ring/30' : 'border-border'"
              loading="lazy"
            >
            <span class="mt-1 block truncate text-xs text-muted-foreground">
              {{ file.originalName }}
            </span>
          </button>
        </div>

        <div class="mt-2 flex items-center gap-4 text-sm">
          <button type="button" class="text-muted-foreground underline hover:text-foreground" @click="choosing = false">
            Cancel
          </button>
          <NuxtLink to="/media" target="_blank" class="text-muted-foreground underline hover:text-foreground">
            Upload another
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
