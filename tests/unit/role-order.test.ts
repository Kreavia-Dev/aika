import { describe, expect, it } from 'vitest'
import { carriesAtLeast } from '../../features/auth/contract'

/**
 * The role ordering, tested where it is decided.
 *
 * WHY THIS FILE EXISTS AND WHY IT IMPORTS THE CONTRACT, NOT A COMPONENT. The
 * browser gate used to be "proven" by reading `app/middleware/admin.ts` as text,
 * which passed even when the comparison was deleted: a test that cannot fail for
 * the thing it names is worse than no test, because it looks like evidence. The
 * decision now lives in one pure function that both the server guard and the
 * middleware call, so it can be tested here, in the `node` environment, with no
 * Nuxt and no HTTP.
 *
 * What is still not tested here is the middleware's plumbing: that it calls this
 * function, and that a false answer redirects. That was checked against a running
 * server by hand, and `docs/aika/ARCHITECTURE.md` records that it is the weaker
 * of the two claims.
 */
describe('carriesAtLeast', () => {
  it('admits an administrator where an editor is required', () => {
    /*
     * The bug this whole change exists to prevent. `requireRole` compares for
     * equality, so gating content work with it would have locked administrators
     * out of their own media library, which is backwards from what an operator
     * expects and was the first thing that looked wrong in review.
     */
    expect(carriesAtLeast('admin', 'editor')).toBe(true)
  })

  it('admits an administrator where an administrator is required', () => {
    expect(carriesAtLeast('admin', 'admin')).toBe(true)
  })

  it('admits an editor where an editor is required', () => {
    expect(carriesAtLeast('editor', 'editor')).toBe(true)
  })

  it('refuses an editor where an administrator is required', () => {
    /*
     * The other direction, and the one that matters for the inbox: an editor must
     * not read a client's inbound messages. If this ever returns true, the change
     * that did it should fail here rather than in production.
     */
    expect(carriesAtLeast('editor', 'admin')).toBe(false)
  })
})
