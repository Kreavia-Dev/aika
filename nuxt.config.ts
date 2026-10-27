export default defineNuxtConfig({
  compatibilityDate: '2026-10-28',
  devtools: { enabled: true },

  // Dev server port. In production Nitro reads `PORT` from the environment
  // instead — see shared/config/env.ts for why the port is not duplicated there.
  devServer: { port: 5555 },

  // Nuxt 4 app dir is `app/`. Feature web surfaces live in `features/<name>/web/`
  // and are registered by the local module in `modules/features.ts`.
  // Local modules in `modules/` are auto-registered — do not list them here.

  typescript: {
    strict: true,
    // Type checking is a CI/deploy gate (`npm run check`), not a dev-server tax.
    typeCheck: false,
  },

  nitro: {
    preset: 'node-server',
    externals: {
      // Native module: must not be bundled.
      external: ['better-sqlite3'],
    },
  },

  runtimeConfig: {
    public: {},
  },

  app: {
    head: {
      title: 'Aika',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
