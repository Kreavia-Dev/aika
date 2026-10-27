/**
 * The two files that have to sit at the root of a domain.
 *
 * Pure string builders, kept out of the route handlers so the shape can be tested
 * without starting a server. The routes in `server/routes/` are thin adapters,
 * the same split used everywhere else in Aika: logic that can be tested lives
 * away from the thing that cannot.
 *
 * WHY THESE ARE NOT HONO ROUTES. Hono is reached through exactly one adapter,
 * `server/api/[...path].ts`, and it owns `/api` entirely. A sitemap is not an API
 * response and an XML parser is not a JSON client, so these belong to Nitro, which
 * already owns everything that is not `/api`.
 */

/**
 * Escapes the five characters that cannot appear literally in XML text.
 *
 * A URL is the only thing interpolated here, and a URL containing `&` is ordinary
 * rather than exotic, so this is not theoretical tidiness.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type SitemapEntry = {
  /** Route path, beginning with a slash. */
  path: string
  /**
   * When the page last meaningfully changed, as `YYYY-MM-DD`.
   *
   * Omitted rather than guessed. A `<lastmod>` that is always "today" because the
   * build ran is a lie a search engine learns to ignore, and it takes the useful
   * `<lastmod>` values down with it.
   */
  lastModified?: string
  /** `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`. */
  changeFrequency?: string
  /** 0.0 to 1.0. */
  priority?: number
}

/**
 * A sitemap for these entries.
 *
 * With `siteUrl` empty this returns a valid but empty `<urlset>`, which is the
 * honest answer: the site's address is not known yet, so there is no list of
 * absolute URLs to publish. See the comment on `site.url` in `app/site.ts`.
 */
export function buildSitemapXml(input: {
  siteUrl: string
  entries: SitemapEntry[]
}): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]

  if (input.siteUrl) {
    for (const entry of input.entries) {
      lines.push('  <url>')
      lines.push(`    <loc>${escapeXml(`${input.siteUrl}${entry.path}`)}</loc>`)

      if (entry.lastModified) lines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`)
      if (entry.changeFrequency) lines.push(`    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`)
      if (entry.priority !== undefined) lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)

      lines.push('  </url>')
    }
  }

  lines.push('</urlset>')
  lines.push('')

  return lines.join('\n')
}

/**
 * The robots file.
 *
 * `/api/` is disallowed because every response there is JSON, and a search engine
 * has no use for any of it while a crawler spends real requests walking it. The
 * `Sitemap` line is only emitted when the site's address is known, because that
 * directive has to be an absolute URL to be read at all.
 */
export function buildRobotsTxt(input: {
  siteUrl: string
  disallow: string[]
}): string {
  const lines = ['User-agent: *']

  for (const path of input.disallow) {
    lines.push(`Disallow: ${path}`)
  }

  if (input.siteUrl) {
    lines.push('')
    lines.push(`Sitemap: ${input.siteUrl}/sitemap.xml`)
  }

  lines.push('')

  return lines.join('\n')
}
