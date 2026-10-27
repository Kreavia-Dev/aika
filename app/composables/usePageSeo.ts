import { site } from '~/site'

/**
 * The head tags a page needs, from one call.
 *
 * WHY THIS EXISTS RATHER THAN `useHead` ON EVERY PAGE. Each page having to
 * remember the canonical, the Open Graph pair, and the Twitter card means each
 * page gets a slightly different subset, and the one that forgets is the one that
 * matters. This composes them from the title and description a page actually has
 * something to say about.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not invent a description or a title.
 * Those are the two tags that decide whether a search result gets clicked, and a
 * generic one repeated across every page is worse than a considered one on the
 * pages that have it. Every page passes its own, so a new page has to think about
 * it for a moment.
 *
 * IT IS USELESS TO A FEATURE PAGE, and that is not an oversight. `site.ts` lives
 * in the client's half of the repository and a feature may not import from `app/`
 * (rule R3). Every feature page here is tooling anyway, so they declare `noindex`
 * instead, which is what a staff screen actually wants.
 */
export function usePageSeo(input: {
  /** Page title only. `nuxt.config.ts` appends the site name. */
  title: string
  /** One sentence, specific to this page. Roughly 150 characters reads best. */
  description: string
}): void {
  const route = useRoute()

  /*
   * Only when the site's address is known. See the comment on `site.url`: a
   * canonical pointing at a placeholder is worse than no canonical, because it
   * tells a search engine the real page lives somewhere it does not.
   */
  const canonical = site.url ? `${site.url}${route.path}` : undefined
  const socialImage = site.url && site.socialImage ? `${site.url}${site.socialImage}` : undefined

  useHead({
    title: input.title,
    meta: [
      { name: 'description', content: input.description },

      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: site.name },
      { property: 'og:title', content: input.title },
      { property: 'og:description', content: input.description },

      /*
       * `summary` rather than `summary_large_image` when there is no image. The
       * large card reserves space for a picture and shows an empty grey rectangle
       * without one.
       */
      { name: 'twitter:card', content: socialImage ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: input.title },
      { name: 'twitter:description', content: input.description },
    ],

    /*
     * Built as a list and filtered, rather than written literally, because the
     * optional entries depend on configuration and an `undefined` in a head array
     * is an easy thing to ship by accident.
     */
    link: canonical ? [{ rel: 'canonical', href: canonical }] : [],
  })

  // Kept separate from the block above so the optional tags stay readable.
  if (canonical) {
    useHead({ meta: [{ property: 'og:url', content: canonical }] })
  }

  if (socialImage) {
    useHead({
      meta: [
        { property: 'og:image', content: socialImage },
        { name: 'twitter:image', content: socialImage },
      ],
    })
  }
}
