import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'

/**
 * Aika feature module.
 *
 * A feature owns its own browser surface under `features/<name>/web/`.
 * This module makes those pages real without any feature having to edit
 * the application's routing. That is what keeps `git pull upstream` from
 * turning into a merge conflict: upstream changes never touch client code.
 *
 * Route convention: features/blog/web/pages/index.vue  ->  /blog
 *                   features/blog/web/pages/[slug].vue ->  /blog/:slug
 */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
    } else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

export default defineNuxtModule({
  meta: {
    name: 'aika-features',
    configKey: 'aikaFeatures',
  },

  setup(_options, nuxt) {
    const featuresDir = join(nuxt.options.rootDir, 'features')
    if (!existsSync(featuresDir)) return

    const features = readdirSync(featuresDir).filter((name) =>
      statSync(join(featuresDir, name)).isDirectory(),
    )

    nuxt.hook('pages:extend', (pages) => {
      for (const feature of features) {
        const pagesDir = join(featuresDir, feature, 'web', 'pages')
        if (!existsSync(pagesDir)) continue

        for (const file of walk(pagesDir)) {
          const rel = relative(pagesDir, file)
            .split(/[\\/]/)
            .join('/')
            .replace(/\.vue$/, '')

          const routePath
            = rel === 'index'
              ? `/${feature}`
              : `/${feature}/${rel.replace(/\/index$/, '')}`

          pages.push({
            name: `${feature}-${rel.replace(/\//g, '-')}`,
            path: routePath,
            file,
          })
        }
      }
    })
  },
})
