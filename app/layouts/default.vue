<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <SiteHeader />

    <main class="flex-1">
      <slot />
    </main>

    <SiteFooter />
  </div>
</template>
