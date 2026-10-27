<script setup lang="ts">
/**
 * The sign in page. Served at /auth/login.
 *
 * A plain form rather than anything clever, because this is the reference
 * implementation a client project will restyle. It posts to the API and lets
 * the API decide, so the browser never validates a credential.
 */
useHead({ title: 'Sign in' })

/*
 * No site chrome on the sign in page. It is reached from the footer, and a
 * navigation bar above a login form invites people to wander off instead of
 * signing in.
 */
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const errorMessage = ref<string | null>(null)
const submitting = ref(false)

/**
 * Narrows an unknown thrown value into something printable.
 *
 * `catch (error)` gives `unknown`, and the API's message lives on
 * `error.data.message`. Reaching it means narrowing twice rather than casting
 * to `any`, which is the habit that makes a codebase unsafe later.
 */
function messageFrom(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data: unknown }).data
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (data as { message: unknown }).message
      if (typeof message === 'string' && message.length > 0) return message
    }
  }

  return 'Sign in failed. Please try again.'
}

async function submit(): Promise<void> {
  errorMessage.value = null
  submitting.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })

    await navigateTo('/')
  }
  catch (error) {
    errorMessage.value = messageFrom(error)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
    <h1 class="text-2xl font-semibold tracking-tight">
      Sign in
    </h1>
    <p class="mt-1 mb-10 text-sm text-muted-foreground">
      Staff access only.
    </p>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="email" class="mb-1.5 block text-sm font-medium">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <div>
        <label for="password" class="mb-1.5 block text-sm font-medium">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        >
      </div>

      <p v-if="errorMessage" class="text-sm font-medium text-destructive">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {{ submitting ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>
