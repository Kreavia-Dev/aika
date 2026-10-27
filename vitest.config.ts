import { defineConfig } from 'vitest/config'

/**
 * Tests are split by what they need to run, not by what they cover.
 *
 * Everything here runs in the `node` environment with no Nuxt build and no
 * HTTP server. The API is testable this way because `shared/http/app.ts`
 * imports nothing from Nitro: a Hono app can be driven directly with a Web
 * `Request`.
 *
 * Environment variables are set here rather than loaded from `.env`, so the
 * suite never depends on a developer's local file and never touches the
 * development database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'features/**/tests/**/*.test.ts',
    ],
    env: {
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5555',
      DATABASE_PATH: './database/test.db',
      APP_VERSION: '0.1.0-test',
      LOG_LEVEL: 'error',
    },
  },
})
