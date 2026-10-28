/**
 * The head tags a public blog page needs, from one call.
 *
 * WHY THIS EXISTS WHEN `app/composables/usePageSeo.ts` ALREADY DOES. That one
 * reads `app/site.ts`, and a feature may not import from `app/` at all: rule R3 in
 * `npm run arch:check` refuses it, and the reason is that `app/` is the client's
 * half of the repository. If a feature imported the site name from there, a
 * client renaming their site would be editing a file that a feature depends on,
 * and the boundary that keeps `git merge upstream` cheap would be gone.
 *
 * So this composer sets only what it can know from the page itself: the title and
 * the description. It deliberately emits no `og:site_name` and no canonical,
 * because both need the site's name and address, and guessing either produces the
 * exact failure `app/site.ts` warns about, a canonical pointing at a placeholder.
 *
 * WHEN A CLIENT WANTS THE FULL SET on their blog, the honest fix is for the
 * client's own page to wrap or replace this one, not for this file to reach into
 * their half.
 *
 * `useHead` IS IMPORTED FROM `@unhead/vue`, AND NUXT WARNS ABOUT IT. Nuxt would
 * rather it came from `#imports`, so that a head hook installed by a client's
 * module still applies. `#imports` does not resolve from inside `features/`,
 * which is why this import exists at all. The warning is accepted and recorded
 * here rather than left as noise somebody deletes the comment for: what it costs
 * is modules that patch `useHead`, and Aika has none. If a client installs one,
 * the fix is to move this composable into that client's `app/`, not to import
 * from `#imports` here.
 */
import { useHead } from '@unhead/vue'

export function usePageSeo(input: {
  /** Page title only. `nuxt.config.ts` appends the site name. */
  title: string
  /** One sentence, specific to this page. Roughly 150 characters reads best. */
  description: string
}): void {
  useHead({
    title: input.title,
    meta: [
      { name: 'description', content: input.description },
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: input.title },
      { property: 'og:description', content: input.description },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: input.title },
      { name: 'twitter:description', content: input.description },
    ],
  })
}
