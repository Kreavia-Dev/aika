<script setup lang="ts">
/**
 * Changing your own password. Served at /auth/password.
 *
 * WHY THIS PAGE EXISTS WHEN REVOKING AN ACCOUNT IS A CLI COMMAND. The person who
 * changes your password has to be you, and you do not have a shell on the server.
 * Revoking somebody else is the opposite: whoever runs the deployment does it,
 * and they do have one.
 *
 * WHAT IT DOES BESIDES CHANGING THE PASSWORD. Every other session is ended. A
 * password change is usually a response to a suspected leak, and a session that
 * outlives the change defeats the reason for making it. The current tab is kept
 * so nobody is thrown out mid-task.
 *
 * Validation is the browser's job for `required` and for the two new fields
 * matching, and the server's job for everything else. The minimum length is not
 * copied into this file on purpose: the server refuses with a message that says
 * the number, and a second copy of it here is a second place for it to change.
 */
import type { ChangePasswordResponse } from '../contract'
import { messageFromApiError } from '~~/shared/http/error-message'

useHead({
  title: 'Change password',
  // Tooling rather than content. See the SEO section in AGENTS.md.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

definePageMeta({ middleware: 'auth' })

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const submitting = ref(false)
const successMessage = ref<string | null>(null)
const errorText = ref<string | null>(null)

const newPasswordsMatch = computed(
  () => form.newPassword.length === 0 || form.newPassword === form.confirmPassword,
)

async function submit(): Promise<void> {
  submitting.value = true
  errorText.value = null
  successMessage.value = null

  try {
    const response = await $fetch<ChangePasswordResponse>('/api/auth/password', {
      method: 'POST',
      body: {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      },
    })

    successMessage.value = response.message
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
  }
  catch (error) {
    errorText.value = messageFromApiError(error, 'Could not change the password. Please try again.')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-6 py-16">
    <h1 class="text-2xl font-semibold tracking-tight">
      Change password
    </h1>

    <p class="mt-2 text-sm text-muted-foreground">
      Changing this ends every other session you have open. This tab stays signed in.
    </p>

    <p v-if="successMessage" role="status" class="mt-8 rounded-md border-l-2 border-success bg-muted px-4 py-3 text-sm">
      {{ successMessage }}
    </p>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <div>
        <label for="current-password" class="mb-1.5 block text-sm font-medium">Current password</label>
        <input
          id="current-password"
          v-model="form.currentPassword"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <div>
        <label for="new-password" class="mb-1.5 block text-sm font-medium">New password</label>
        <input
          id="new-password"
          v-model="form.newPassword"
          type="password"
          autocomplete="new-password"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <div>
        <label for="confirm-password" class="mb-1.5 block text-sm font-medium">New password again</label>
        <input
          id="confirm-password"
          v-model="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
        <p v-if="!newPasswordsMatch" class="mt-1.5 text-sm text-destructive">
          The two new passwords are not the same.
        </p>
      </div>

      <p v-if="errorText" role="alert" class="text-sm font-medium text-destructive">
        {{ errorText }}
      </p>

      <button
        type="submit"
        :disabled="submitting || !newPasswordsMatch"
        class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {{ submitting ? 'Changing...' : 'Change password' }}
      </button>
    </form>

    <p class="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
      Forgotten rather than changing it? There is no reset by email, because there
      is no mail server. Whoever runs the deployment replaces the password from the
      shell with <code class="font-mono text-xs">npm run user:password</code>, and that
      ends every session this account has open, including one you are using now.
    </p>
  </div>
</template>
