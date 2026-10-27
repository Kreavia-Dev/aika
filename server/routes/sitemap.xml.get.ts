import { defineEventHandler, setHeader } from 'h3'
import { site } from '../../app/site'
import { buildSitemapXml } from '../../shared/seo/site-files'

/**
 * sitemap.xml.
 *
 * A Nitro route for the same reason as `robots.txt`: an XML document is not an
 * API response, and the file belongs at the root of the domain.
 *
 * THE PAGE LIST COMES FROM `site.nav`, which is the client's own declaration of
 * what the site contains. That is also why the staff screens are absent without
 * anything needing to exclude them: they are not in the navigation and they carry
 * `noindex`, because they are tooling rather than content.
 *
 * A feature with public content of its own, a blog being the obvious one, cannot
 * contribute here yet. It has no way to tell this file what it published, and
 * inventing one means a content registry, which is the same question as the CMS
 * decision still open on the roadmap. Until then this file lists the pages the
 * client wrote down, which is honest and complete for a site of this size.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')

  return buildSitemapXml({
    siteUrl: site.url,
    /*
     * `changefreq` and `priority` are left off on purpose. Google has said it
     * ignores both, and a value that is ignored but present is a value somebody
     * will keep up to date for no reason. `<lastmod>` is the one hint that is
     * read, and it is omitted too rather than filled with the build time, because
     * a `<lastmod>` that is always today is worse than none.
     */
    entries: site.nav.map(item => ({ path: item.path })),
  })
})
