import { join } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'
import { collectFeaturePages } from '../shared/nuxt/feature-pages'

/**
 * Aika feature module.
 *
 * A feature owns its own browser surface under `features/<name>/web/pages/`.
 * This module makes those pages real routes without any feature having to edit
 * the application's routing. That is what keeps `git pull upstream` from
 * turning into a merge conflict: upstream changes never touch client code.
 *
 * The route computation itself lives in `shared/nuxt/feature-pages.ts` as a
 * pure function, so it is covered by unit tests rather than by hoping.
 */
export default defineNuxtModule({
  meta: {
    name: 'aika-features',
    configKey: 'aikaFeatures',
  },

  setup(_options, nuxt) {
    const featuresDir = join(nuxt.options.rootDir, 'features')

    nuxt.hook('pages:extend', (pages) => {
      for (const page of collectFeaturePages(featuresDir)) {
        pages.push({
          name: page.name,
          path: page.path,
          file: page.file,
        })
      }
    })
  },
})
