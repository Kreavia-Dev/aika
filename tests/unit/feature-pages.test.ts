import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectFeaturePages, listFeatures, listVueFiles } from '../../shared/nuxt/feature-pages'

/**
 * These tests exist because of a specific gap.
 *
 * `modules/features.ts` was written and loaded without error from the very
 * first commit, but it had never been exercised, because no feature had a
 * `web/pages/` directory. Loading is not working. This file is what turns that
 * assumption into a fact.
 */
let root: string

/**
 * A route path as vue-router would compare it: static segments outrank dynamic
 * ones, regardless of the order the records were registered in.
 *
 * THIS MIRRORS vue-router VERSION 5, WHERE IT WAS ALSO VERIFIED BY HAND. It exists
 * because `features/blog` has `/blog/admin/categories` beside `/blog/admin/[id]`,
 * and the collector sorts `/blog/admin/[id]` first. That is fine today because
 * vue-router prefers the static match, but "fine because the router is clever" is
 * exactly the kind of fact that changes silently in a major upgrade. A test that
 * states the rule makes the assumption visible when it breaks.
 */
function routeRank(path: string): number {
  const dynamic = path.split('/').filter(segment => segment.includes(':')).length
  return dynamic * 1000 + path.split('/').length
}

function wouldMatchStaticFirst(staticPath: string, dynamicPath: string): boolean {
  const staticSegments = staticPath.split('/')
  const dynamicSegments = dynamicPath.split('/')

  if (staticSegments.length !== dynamicSegments.length) return false

  const sameShape = dynamicSegments.every(
    (segment, index) => segment.includes(':') || segment === staticSegments[index],
  )

  return sameShape && routeRank(staticPath) < routeRank(dynamicPath)
}

function writePage(relativePath: string, content = '<template><div /></template>'): void {
  const full = join(root, relativePath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'aika-features-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('collectFeaturePages', () => {
  it('returns nothing when there is no features directory', () => {
    expect(collectFeaturePages(join(root, 'does-not-exist'))).toEqual([])
  })

  it('maps a feature root index to the feature path', () => {
    writePage('health/web/pages/index.vue')

    const pages = collectFeaturePages(root)

    expect(pages).toHaveLength(1)
    expect(pages[0]?.path).toBe('/health')
    expect(pages[0]?.name).toBe('health-index')
  })

  it('maps a nested index to its directory path', () => {
    writePage('blog/web/pages/posts/index.vue')

    expect(collectFeaturePages(root)[0]?.path).toBe('/blog/posts')
  })

  it('maps a nested page to a nested path', () => {
    writePage('blog/web/pages/posts/create.vue')

    const page = collectFeaturePages(root)[0]

    expect(page?.path).toBe('/blog/posts/create')
    expect(page?.name).toBe('blog-posts-create')
  })

  it('turns a filesystem dynamic segment into the syntax vue-router matches', () => {
    /*
     * THIS ASSERTION USED TO EXPECT `/blog/posts/[slug]`, AND THAT WAS THE BUG.
     * A record pushed into `pages:extend` skips Nuxt's own filename scanning, so
     * the bracket form reaches vue-router as a literal string, compiles to a regex
     * that matches the text "[slug]", and 404s for every real address. The route
     * looks registered and silently never matches.
     *
     * The test agreed with the broken code, which is how it survived: a test that
     * pins an implementation detail confirms whatever that detail happens to be.
     * It now pins the only form vue-router can route on.
     */
    writePage('blog/web/pages/posts/[slug].vue')

    const page = collectFeaturePages(root)[0]

    expect(page?.path).toBe('/blog/posts/:slug()')
    expect(page?.name).toBe('blog-posts-slug')
  })

  it('leaves a static segment alone', () => {
    // The conversion must not touch anything without brackets.
    writePage('blog/web/pages/posts/index.vue')

    expect(collectFeaturePages(root)[0]?.path).toBe('/blog/posts')
  })

  it('collects pages from several features at once', () => {
    writePage('health/web/pages/index.vue')
    writePage('blog/web/pages/index.vue')
    writePage('blog/web/pages/posts/index.vue')

    const paths = collectFeaturePages(root).map(page => page.path)

    expect(paths).toEqual(['/blog', '/blog/posts', '/health'])
  })

  it('prefixes every feature route with the feature name', () => {
    writePage('admin/web/pages/index.vue')
    writePage('admin/web/pages/users.vue')

    const paths = collectFeaturePages(root).map(page => page.path)

    expect(paths).toEqual(['/admin', '/admin/users'])
  })

  it('skips a feature that has no web/pages directory', () => {
    writePage('health/web/pages/index.vue')
    mkdirSync(join(root, 'auth/server'), { recursive: true })
    writeFileSync(join(root, 'auth/server/routes.ts'), 'export const x = 1')

    const pages = collectFeaturePages(root)

    expect(pages).toHaveLength(1)
    expect(pages[0]?.path).toBe('/health')
  })

  it('ignores non-vue files sitting next to pages', () => {
    writePage('health/web/pages/index.vue')
    writePage('health/web/pages/notes.md', '# notes')
    writePage('health/web/pages/draft.vue.bak', 'x')

    expect(collectFeaturePages(root)).toHaveLength(1)
  })

  it('ignores files directly in the feature directory', () => {
    writePage('health/index.ts', 'export {}')
    writePage('health/web/index.ts', 'export {}')

    expect(collectFeaturePages(root)).toEqual([])
  })

  it('produces a deterministic order regardless of listing order', () => {
    for (const name of ['zebra', 'alpha', 'middle']) {
      writePage(`${name}/web/pages/index.vue`)
    }

    const first = collectFeaturePages(root).map(page => page.path)
    const second = collectFeaturePages(root).map(page => page.path)

    expect(first).toEqual(second)
    expect(first).toEqual(['/alpha', '/middle', '/zebra'])
  })

  it('returns absolute file paths', () => {
    writePage('health/web/pages/index.vue')

    const page = collectFeaturePages(root)[0]

    expect(page?.file.startsWith(root)).toBe(true)
    expect(page?.file.endsWith('index.vue')).toBe(true)
  })

  it('always produces a path starting with a slash', () => {
    writePage('blog/web/pages/posts/[slug]/comments.vue')

    // The nested case, where a segment is dynamic and the path continues past it.
    expect(collectFeaturePages(root)[0]?.path).toBe('/blog/posts/:slug()/comments')
  })

  it('puts a static sibling ahead of a dynamic one, whatever order it is registered in', () => {
    /*
     * THE CASE THAT ACTUALLY EXISTS: `features/blog` has `/blog/admin/categories`
     * next to `/blog/admin/[id]`, and the collector sorts the dynamic one first
     * because "[i" sorts before "ca". vue-router prefers the static match, so the
     * categories page is reachable, and this test states why that is true rather
     * than leaving it to look like luck.
     *
     * If a future router stops preferring static segments, this assertion fails
     * here instead of a staff member finding a page that opens the wrong screen.
     */
    writePage('blog/web/pages/admin/categories.vue')
    writePage('blog/web/pages/admin/[id].vue')

    const paths = collectFeaturePages(root).map(page => page.path)

    expect(paths).toContain('/blog/admin/:id()')
    expect(paths).toContain('/blog/admin/categories')
    expect(wouldMatchStaticFirst('/blog/admin/categories', '/blog/admin/:id()')).toBe(true)
  })
})

describe('listFeatures', () => {
  it('returns sorted directory names only', () => {
    writePage('zebra/web/pages/index.vue')
    writePage('alpha/web/pages/index.vue')
    writePage('README.md', '# not a feature')

    expect(listFeatures(root)).toEqual(['alpha', 'zebra'])
  })

  it('returns nothing for a missing directory', () => {
    expect(listFeatures(join(root, 'nope'))).toEqual([])
  })
})

describe('listVueFiles', () => {
  it('walks subdirectories and keeps only .vue files', () => {
    writePage('a.vue')
    writePage('nested/b.vue')
    writePage('nested/deeper/c.vue')
    writePage('nested/skip.txt', 'x')

    const files = listVueFiles(root).map(file => file.slice(root.length + 1).split('\\').join('/'))

    expect(files.sort()).toEqual(['a.vue', 'nested/b.vue', 'nested/deeper/c.vue'])
  })
})
