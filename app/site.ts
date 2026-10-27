/**
 * Everything specific to this client lives here.
 *
 * THIS IS THE FIRST FILE TO EDIT IN A NEW CLIENT PROJECT.
 *
 * The site name, the tagline, the navigation, the contact details, and the
 * language are collected here so that rebranding is one file rather than a hunt
 * through components. `app/layouts/default.vue` and the pages read from it, and
 * `nuxt.config.ts` uses it for the page title and the `lang` attribute.
 *
 * The copy below is a placeholder. Writing it in Indonesian for an Indonesian
 * client is expected and correct: `app/**` is a client facing surface, and
 * `npm run prose:check` deliberately exempts it from the English-only rule that
 * applies to framework code.
 */
export type NavItem = {
  label: string
  path: string
}

export const site = {
  /** Shown in the header, the footer, and the browser tab. */
  name: 'Meridian Studio',

  /** One line, used as the home page headline. */
  tagline: 'Websites for businesses that have outgrown a template.',

  /**
   * The document language. Change to `id` for an Indonesian site. It matters for
   * screen readers and for search engines, and it is one character.
   */
  lang: 'en',

  nav: [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ] satisfies NavItem[],

  contact: {
    email: 'hello@example.com',
    phone: '+62 21 0000 0000',
    address: 'Jakarta, Indonesia',
  },
}
