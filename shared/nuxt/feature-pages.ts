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
  /*
   * Bracket markers are dropped from the NAME only. `[slug]` becomes `slug`, so
   * the name is `blog-slug` rather than `blog-[slug]`, because a route name is a
   * string that appears in devtools and error messages and the markers make it
   * harder to read there. Names have no routing meaning.
   */
  const name = relativePath.replace(/\[\.{0,3}([^\]]+)\]/g, '$1')
  return `${feature}-${name.replace(/\//g, '-')}`
}

/**
 * Filesystem `[slug]` syntax to the `:slug` syntax vue-router actually matches.
 *
 * WHY THIS CONVERSION IS NECESSARY, MEASURED RATHER THAN ASSUMED. Nuxt normally
 * builds route records by scanning files on disk, and that scanning is what turns
 * `[slug].vue` into a parameter. A record pushed into `pages:extend` skips that
 * step entirely: vue-router receives the literal string `/blog/[slug]` and
 * compiles a regex that matches the text "[slug]" and nothing else. The route
 * looks registered, appears in the generated route list, and quietly 404s for
 * every real address. That cost an afternoon, so the conversion is done here
 * where the path is built rather than trusted to happen later.
 *
 * The empty parentheses `:slug()` are vue-router's own print of an unconstrained
 * parameter, which is what `unrouting` produces for a bare `[slug]` file.
 */
function toVueRouterPath(path: string): string {
  return path.replace(/\[\.{0,3}([^\]]+)\]/g, ':$1()')
}

function toRoutePath(feature: string, relativePath: string): string {
  if (relativePath === 'index') return `/${feature}`

  const withoutTrailingIndex = relativePath.replace(/\/index$/, '')
  return `/${feature}/${toVueRouterPath(withoutTrailingIndex)}`
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
