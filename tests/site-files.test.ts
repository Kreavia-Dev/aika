import { describe, expect, it } from 'vitest'
import { buildRobotsTxt, buildSitemapXml } from '../shared/seo/site-files'

/**
 * The two files that sit at the root of a domain.
 *
 * These are pure string builders, so they are tested here rather than through a
 * running server. What the running server does with them is asserted by the smoke
 * test in CI, which is the half a unit test cannot reach.
 */
describe('buildSitemapXml', () => {
  it('emits a valid, empty urlset when the site address is unknown', () => {
    const xml = buildSitemapXml({ siteUrl: '', entries: [{ path: '/' }, { path: '/about' }] })

    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
    // Not a list of relative URLs, and not a list of example.com URLs. Neither is
    // publishable, so neither is published.
    expect(xml).not.toContain('<url>')
  })

  it('emits an absolute loc for each entry once the address is known', () => {
    const xml = buildSitemapXml({
      siteUrl: 'https://aika.example',
      entries: [{ path: '/' }, { path: '/contact' }],
    })

    expect(xml).toContain('<loc>https://aika.example/</loc>')
    expect(xml).toContain('<loc>https://aika.example/contact</loc>')
  })

  it('escapes an ampersand in a URL rather than emitting broken XML', () => {
    const xml = buildSitemapXml({
      siteUrl: 'https://aika.example',
      entries: [{ path: '/search?q=a&b=c' }],
    })

    expect(xml).toContain('a&amp;b=c')
    expect(xml).not.toContain('a&b=c')
  })

  it('omits changefreq and priority unless they are asked for', () => {
    const bare = buildSitemapXml({ siteUrl: 'https://aika.example', entries: [{ path: '/' }] })
    expect(bare).not.toContain('<changefreq>')
    expect(bare).not.toContain('<priority>')

    const full = buildSitemapXml({
      siteUrl: 'https://aika.example',
      entries: [{ path: '/', changeFrequency: 'monthly', priority: 1 }],
    })

    expect(full).toContain('<changefreq>monthly</changefreq>')
    expect(full).toContain('<priority>1.0</priority>')
  })
})

describe('buildRobotsTxt', () => {
  it('disallows the API for every agent', () => {
    const robots = buildRobotsTxt({ siteUrl: '', disallow: ['/api/'] })

    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Disallow: /api/')
  })

  it('omits the Sitemap directive when the address is unknown', () => {
    // The directive has to be an absolute URL to be read at all, so a relative
    // one would be worse than absent.
    const robots = buildRobotsTxt({ siteUrl: '', disallow: [] })

    expect(robots).not.toContain('Sitemap:')
  })

  it('points at the sitemap once the address is known', () => {
    const robots = buildRobotsTxt({ siteUrl: 'https://aika.example', disallow: ['/api/'] })

    expect(robots).toContain('Sitemap: https://aika.example/sitemap.xml')
  })
})
