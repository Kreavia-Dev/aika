import { defineEventHandler, setHeader } from 'h3'
import { site } from '../../app/site'
import { buildRobotsTxt } from '../../shared/seo/site-files'

/**
 * robots.txt.
 *
 * A Nitro route rather than a Hono one because Hono is reached through exactly
 * one adapter and owns `/api` entirely. This file has to sit at the root of the
 * domain with that exact name, which is Nitro's territory.
 *
 * `/api/` is disallowed because everything under it is JSON. A crawler walking it
 * spends real requests on responses no search engine can use, and on a small
 * deployment those requests are not free.
 *
 * What this file deliberately does NOT do is try to hide the staff screens.
 * `Disallow` only asks a crawler not to fetch a path; it does not keep the path out
 * of an index, and a page can be indexed from a link without ever being fetched.
 * Those pages carry `noindex` on themselves, which is the only thing that works.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')

  return buildRobotsTxt({
    siteUrl: site.url,
    disallow: ['/api/'],
  })
})
