import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The two things about a staff screen that only a page can declare.
 *
 * WHAT THIS FILE IS NOT. It does not test the administrator gate. An earlier
 * version of this file did, by asserting that `admin.ts` contained certain strings,
 * and it passed with the role comparison deleted: a test that cannot fail for the
 * thing it claims to protect is worse than no test, because it reads as evidence.
 * The decision itself is now a pure function with a real test in
 * `tests/unit/role-order.test.ts`, and the middleware's redirect was checked
 * against a running server by hand.
 *
 * What is left is the part that genuinely lives only in the template: which
 * middlewares a page names, and whether it keeps itself out of search results. A
 * string assertion is the honest tool for a declaration, because the declaration
 * is a string.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function source(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

describe('features/contact/web/pages/messages.vue', () => {
  it('requires an administrator as well as a session', () => {
    /*
     * `auth` first, so an anonymous visitor still reaches the sign in form rather
     * than being sent to the home page. Both are named, in that order, because the
     * order is what decides which of the two refusals a visitor meets.
     *
     * Removing `admin` here would leave the page asking a route that answers 403,
     * which renders as a broken screen rather than a refusal. That is the failure
     * this assertion prevents, and it is a real one.
     */
    expect(source('features/contact/web/pages/messages.vue'))
      .toContain(`definePageMeta({ middleware: ['auth', 'admin'] })`)
  })

  it('keeps itself out of search results', () => {
    // A staff screen declares this itself, because robots.txt cannot stop a page
    // being indexed from a link that was never fetched.
    expect(source('features/contact/web/pages/messages.vue'))
      .toContain(`name: 'robots', content: 'noindex, nofollow'`)
  })
})
