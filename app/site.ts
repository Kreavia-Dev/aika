/**
 * Everything specific to this site lives here.
 *
 * THIS IS THE FIRST FILE TO EDIT IN A NEW CLIENT PROJECT.
 *
 * Right now this is Aika's own reference site: the name, the copy, and the
 * navigation describe Aika, because this repository is the example. When a real
 * project starts, replace the contents of this file with the client's name,
 * tagline, and navigation, and the whole site follows.
 *
 * The copy is in English. Writing it in Indonesian for an Indonesian client is
 * expected and correct: `app/**` is a client facing surface, and
 * `npm run prose:check` deliberately exempts it from the English-only rule that
 * applies to framework code.
 */
export type NavItem = {
  label: string
  path: string
}

export const site = {
  /** Shown in the header, the footer, and the browser tab. */
  name: 'Aika',

  /** One line, used as the home page headline. */
  tagline: 'A reference site, built with Aika.',

  /**
   * The document language. Change to `id` for an Indonesian site. It matters
   * for screen readers and for search engines, and it is one character.
   */
  lang: 'en',

  nav: [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ] satisfies NavItem[],

  /**
   * A small fixed mark in the corner of every page.
   *
   * This is the AGENCY's credit, not the client's, which is why it is a separate
   * switch from `name` above. The client's own credit usually lives in the
   * footer, the way "site by Somebody" does.
   *
   * Set `show` to false for a client who does not want it, or change `text` to
   * your studio's name. Deleting this file is not the way to turn it off,
   * because a future upstream change would bring it back.
   */
  watermark: {
    show: true,
    text: 'AIKA',
  },

  contact: {
    email: 'hello@example.com',
    phone: '+62 21 0000 0000',
    address: 'Jakarta, Indonesia',
  },
}
