import { z } from 'zod'

/**
 * The single place `process.env` is read in Aika.
 *
 * Everything downstream receives a validated, typed object. If a required
 * variable is missing or malformed, the process fails at startup with a
 * readable message rather than crashing later in a request handler.
 *
 * NOTE: `PORT` is deliberately NOT here. Nitro owns the listening socket and
 * reads `PORT` itself (default 3000). Mirroring it here would create a second
 * source of truth that can silently disagree with the port actually bound.
 * Exactly the kind of bug that wastes an afternoon. Dev uses 5555 via
 * `devServer.port` in nuxt.config.ts; production sets `PORT` in its env file.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  APP_URL: z.string().min(1).default('http://localhost:5555'),

  APP_VERSION: z.string().min(1).default('0.1.0'),

  DATABASE_PATH: z.string().min(1).default('./database/aika.db'),

  /*
   * Where uploaded files are written.
   *
   * Relative in development, so a fresh clone needs no setup and the files land
   * in a gitignored directory. Absolute in production, beside the database and
   * outside the deployed application directory, so that a deploy which replaces
   * the build cannot remove a client's images. That is the same reasoning as
   * DATABASE_PATH above, and the two should point at the same volume.
   */
  MEDIA_ROOT: z.string().min(1).default('./storage/media'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map(issue => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')

    throw new Error(`Invalid environment configuration:\n${details}`)
  }

  const value = parsed.data

  // Production must say who it is. Relative URLs and localhost silently
  // break cookies, canonical links and SEO on a real deployment.
  if (value.NODE_ENV === 'production' && !value.APP_URL.startsWith('https://')) {
    throw new Error(
      'APP_URL must be an absolute https:// URL when NODE_ENV=production.',
    )
  }

  return value
}

export const env: Env = loadEnv()

export const isProduction: boolean = env.NODE_ENV === 'production'
