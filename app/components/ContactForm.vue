<script setup lang="ts">
/**
 * The contact form, owned by the client project.
 *
 * WHY THIS IS NOT IN THE FEATURE. It is the client's, because the wording and
 * usually the fields differ per client, and a shared file that every client edits
 * means every upstream change to it conflicts. `features/contact/contract.ts`
 * has the longer version of that argument.
 *
 * The feature still gives this form what matters: the request and response types,
 * the validation rules on the server, and the endpoint. So this file can be
 * rewritten freely without any risk of the data going somewhere wrong.
 *
 * Validation is done by the browser first, through `required`, `type="email"`,
 * and `minlength`. The API validates again and this shows whatever it says, so a
 * submission that slips past the browser still gets a real answer rather than a
 * silent failure. The API is the authority; the browser is a convenience.
 */
import type { ContactResponse } from '~~/features/contact/web'
import { messageFromApiError } from '~~/shared/http/error-message'

withDefaults(defineProps<{
  submitLabel?: string
}>(), {
  submitLabel: 'Send message',
})

const form = reactive({
  name: '',
  email: '',
  message: '',
  /**
   * The honeypot. Never displayed, never focusable, and ignored by password
   * managers. Named `website` because that is what a bot filling every field
   * looks for. It travels with the payload and the server drops the message when
   * it is filled.
   */
  website: '',
})

const sending = ref(false)
const sentMessage = ref<string | null>(null)
const errorText = ref<string | null>(null)

async function submit(): Promise<void> {
  sending.value = true
  errorText.value = null

  try {
    // The type comes from the feature's contract, so a change to the response
    // shape breaks this at compile time rather than at runtime.
    const response = await $fetch<ContactResponse>('/api/contact', {
      method: 'POST',
      body: { ...form },
    })

    // The envelope's `message` is what the server wants the visitor to read, so
    // the client does not keep a second copy of the wording.
    sentMessage.value = response.message
  }
  catch (error) {
    errorText.value = messageFromApiError(error, 'Could not send that. Please try again.')
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="sentMessage" role="status" class="rounded-md border-l-2 border-success bg-muted px-4 py-3 text-sm">
      {{ sentMessage }}
    </p>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="contact-name" class="mb-1.5 block text-sm font-medium">Your name</label>
        <input
          id="contact-name"
          v-model="form.name"
          type="text"
          autocomplete="name"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <div>
        <label for="contact-email" class="mb-1.5 block text-sm font-medium">Email</label>
        <input
          id="contact-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <div>
        <label for="contact-message" class="mb-1.5 block text-sm font-medium">Message</label>
        <textarea
          id="contact-message"
          v-model="form.message"
          rows="6"
          required
          minlength="10"
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <!--
        The honeypot. `sr-only` keeps it out of sight without removing it from the
        DOM, `tabindex="-1"` keeps a keyboard user from landing on it, and
        `autocomplete="off"` keeps a password manager from helpfully filling it
        and getting the visitor's own message dropped as spam.
      -->
      <div class="sr-only" aria-hidden="true">
        <label for="contact-website">Website</label>
        <input
          id="contact-website"
          v-model="form.website"
          type="text"
          tabindex="-1"
          autocomplete="off"
        >
      </div>

      <p v-if="errorText" role="alert" class="text-sm font-medium text-destructive">
        {{ errorText }}
      </p>

      <button
        type="submit"
        :disabled="sending"
        class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {{ sending ? 'Sending...' : submitLabel }}
      </button>
    </form>
  </div>
</template>
