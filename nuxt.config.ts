import tailwindcss from '@tailwindcss/vite'
import { site } from './app/site'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-28',
  devtools: { enabled: true },

  // Dev server port. In production Nitro reads `PORT` from the environment
  // instead: see shared/config/env.ts for why the port is not duplicated there.
  devServer: { port: 5555 },

  // Styling is Tailwind CSS v4, wired through the Vite plugin rather than a
  // Nuxt module. `app/assets/css/main.css` declares the source roots, including
  // `features/`, and maps the tokens in `palette.css` onto Tailwind's theme.
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  // Nuxt 4 app dir is `app/`. Feature web surfaces live in `features/<name>/web/`
  // and are registered by the local module in `modules/features.ts`.
  // Local modules in `modules/` are auto-registered: do not list them here.

  typescript: {
    strict: true,
    // Type checking is a CI/deploy gate (`npm run check`), not a dev-server tax.
    typeCheck: false,
  },

  nitro: {
    preset: 'node-server',
    externals: {
      // Native module: must not be bundled.
      external: ['better-sqlite3', 'sharp'],
    },
  },

  runtimeConfig: {
    public: {},
  },

  app: {
    head: {
      // Read from `app/site.ts`, so the client's name lives in one place. The
      // function form of `titleTemplate` is not accepted here, only a string, so
      // every page sets its own title.
      title: site.name,
      titleTemplate: `%s · ${site.name}`,
      htmlAttrs: { lang: site.lang },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
