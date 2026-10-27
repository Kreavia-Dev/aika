import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Turns a feature's browser pages into Nuxt route records.
 *
 * Kept as a pure function, separate from the Nuxt module that calls it, so it
 * can be tested without booting Nuxt. The module is a thin adapter.
 *
 * Convention:
 *   features/health/web/pages/index.vue        -> /health
 *   features/blog/web/pages/posts/index.vue    -> /blog/posts
 *   features/blog/web/pages/posts/[slug].vue   -> /blog/posts/[slug]
 *
 * Everything a feature puts in its own `web/pages/` is mounted under its own
 * name. That is the whole point: a feature never edits the application's
 * routing, which is what keeps `git merge upstream/main` cheap in a client
 * project.
 */
export type FeaturePage = {
  /** Route name. Unique, because it includes the feature name. */
  name: string
  /** Absolute route path. Always starts with a slash. */
  path: string
  /** Absolute path to the .vue file. */
  file: string
}

/** Recursively collects `.vue` files. Returns absolute paths. */
export function listVueFiles(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listVueFiles(full))
    }
    else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }

  return out
}

/** Feature directory names, in a stable order. Missing directory yields none. */
export function listFeatures(featuresDir: string): string[] {
  if (!existsSync(featuresDir)) return []

  return readdirSync(featuresDir)
    .filter(name => statSync(join(featuresDir, name)).isDirectory())
    .sort()
}

function toRouteName(feature: string, relativePath: string): string {
  return `${feature}-${relativePath.replace(/\//g, '-')}`
}

function toRoutePath(feature: string, relativePath: string): string {
  if (relativePath === 'index') return `/${feature}`

  const withoutTrailingIndex = relativePath.replace(/\/index$/, '')
  return `/${feature}/${withoutTrailingIndex}`
}

/**
 * Collects every page across every feature.
 *
 * Sorted by route path so route registration order is deterministic. Nuxt's
 * own routing is order sensitive for competing patterns, and a filesystem
 * listing order is not something to depend on.
 */
export function collectFeaturePages(featuresDir: string): FeaturePage[] {
  const pages: FeaturePage[] = []

  for (const feature of listFeatures(featuresDir)) {
    const pagesDir = join(featuresDir, feature, 'web', 'pages')
    if (!existsSync(pagesDir)) continue

    for (const file of listVueFiles(pagesDir)) {
      const relativePath = relative(pagesDir, file)
        .split(/[\\/]/)
        .join('/')
        .replace(/\.vue$/, '')

      pages.push({
        name: toRouteName(feature, relativePath),
        path: toRoutePath(feature, relativePath),
        file,
      })
    }
  }

  return pages.sort((a, b) => a.path.localeCompare(b.path))
}
