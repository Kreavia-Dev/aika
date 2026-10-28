import { getDb } from '../../../shared/database/client'

/**
 * All SQL for this feature.
 *
 * Nothing here validates or decides. It reads and writes rows, and the service
 * does the thinking, which is the rule the other features follow too.
 */

/** A row exactly as SQLite returns it, snake_case included. */
export type PostRow = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  cover_media_id: string | null
  category_id: string | null
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
}

export type CategoryRow = {
  id: string
  slug: string
  name: string
  sort_order: number
}

/**
 * The public list joins the cover image and the category, because a list of posts
 * with an N+1 query per row is the classic way a blog page becomes slow as a
 * client writes more.
 *
 * A LEFT JOIN rather than INNER: a post with no cover or no category is a normal
 * state, not a broken row, and an INNER JOIN would silently hide it.
 */
const PUBLISHED_SELECT = `
  SELECT
    p.id, p.slug, p.title, p.summary, p.body,
    p.cover_media_id, p.category_id, p.status,
    p.published_at, p.created_at, p.updated_at,
    m.filename AS cover_filename,
    c.slug AS category_slug,
    c.name AS category_name
  FROM blog_posts p
  LEFT JOIN media_files m ON m.id = p.cover_media_id
  LEFT JOIN blog_categories c ON c.id = p.category_id
`

export type PublishedRow = PostRow & {
  cover_filename: string | null
  category_slug: string | null
  category_name: string | null
}

/**
 * Published posts, newest first, optionally narrowed to one category.
 *
 * `categorySlug` is a bound parameter, never interpolated: it arrives from a URL
 * and is therefore whatever somebody typed.
 */
export function findPublishedPosts(input: {
  categorySlug?: string
  limit: number
  offset: number
}): PublishedRow[] {
  if (input.categorySlug === undefined) {
    return getDb()
      .prepare(`
        ${PUBLISHED_SELECT}
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC, p.rowid DESC
        LIMIT ? OFFSET ?
      `)
      .all(input.limit, input.offset) as PublishedRow[]
  }

  return getDb()
    .prepare(`
      ${PUBLISHED_SELECT}
      WHERE p.status = 'published' AND c.slug = ?
      ORDER BY p.published_at DESC, p.rowid DESC
      LIMIT ? OFFSET ?
    `)
    .all(input.categorySlug, input.limit, input.offset) as PublishedRow[]
}

/**
 * One more row than the page asked for, to answer "is there a next page" without
 * a COUNT over a table that only grows.
 */
export function hasPublishedPostsPast(input: {
  categorySlug?: string
  offset: number
}): boolean {
  if (input.categorySlug === undefined) {
    const row = getDb()
      .prepare(`
        SELECT 1 AS present FROM blog_posts
        WHERE status = 'published'
        LIMIT 1 OFFSET ?
      `)
      .get(input.offset) as { present: number } | undefined

    return row !== undefined
  }

  const row = getDb()
    .prepare(`
      SELECT 1 AS present
      FROM blog_posts p
      JOIN blog_categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND c.slug = ?
      LIMIT 1 OFFSET ?
    `)
    .get(input.categorySlug, input.offset) as { present: number } | undefined

  return row !== undefined
}

export function findPublishedPostBySlug(slug: string): PublishedRow | undefined {
  return getDb()
    .prepare(`
      ${PUBLISHED_SELECT}
      WHERE p.slug = ? AND p.status = 'published'
    `)
    .get(slug) as PublishedRow | undefined
}

/** Every post, drafts included, for the staff screen. */
export function findAllPosts(): PostRow[] {
  return getDb()
    .prepare(`
      SELECT id, slug, title, summary, body, cover_media_id, category_id,
             status, published_at, created_at, updated_at
      FROM blog_posts
      ORDER BY created_at DESC, rowid DESC
    `)
    .all() as PostRow[]
}

export function findPostById(id: string): PostRow | undefined {
  return getDb()
    .prepare(`
      SELECT id, slug, title, summary, body, cover_media_id, category_id,
             status, published_at, created_at, updated_at
      FROM blog_posts
      WHERE id = ?
    `)
    .get(id) as PostRow | undefined
}

/**
 * Used to refuse a duplicate slug before writing, so the caller gets a readable
 * conflict instead of a UNIQUE constraint error from SQLite.
 */
export function findPostBySlug(slug: string): PostRow | undefined {
  return getDb()
    .prepare(`
      SELECT id, slug, title, summary, body, cover_media_id, category_id,
             status, published_at, created_at, updated_at
      FROM blog_posts
      WHERE slug = ?
    `)
    .get(slug) as PostRow | undefined
}

export function insertPost(post: {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  coverMediaId: string | null
  categoryId: string | null
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}): void {
  getDb()
    .prepare(`
      INSERT INTO blog_posts
        (id, slug, title, summary, body, cover_media_id, category_id,
         status, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      post.id,
      post.slug,
      post.title,
      post.summary,
      post.body,
      post.coverMediaId,
      post.categoryId,
      post.status,
      post.publishedAt,
      post.createdAt,
      post.updatedAt,
    )
}

export function updatePost(post: {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  coverMediaId: string | null
  categoryId: string | null
  status: 'draft' | 'published'
  publishedAt: string | null
  updatedAt: string
}): void {
  getDb()
    .prepare(`
      UPDATE blog_posts
      SET slug = ?, title = ?, summary = ?, body = ?, cover_media_id = ?,
          category_id = ?, status = ?, published_at = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      post.slug,
      post.title,
      post.summary,
      post.body,
      post.coverMediaId,
      post.categoryId,
      post.status,
      post.publishedAt,
      post.updatedAt,
      post.id,
    )
}

export function deletePostById(id: string): number {
  return getDb().prepare('DELETE FROM blog_posts WHERE id = ?').run(id).changes
}

/** Ordered by hand first, then by name so ties are stable rather than arbitrary. */
export function findCategories(): CategoryRow[] {
  return getDb()
    .prepare('SELECT id, slug, name, sort_order FROM blog_categories ORDER BY sort_order, name')
    .all() as CategoryRow[]
}

export function findCategoryById(id: string): CategoryRow | undefined {
  return getDb()
    .prepare('SELECT id, slug, name, sort_order FROM blog_categories WHERE id = ?')
    .get(id) as CategoryRow | undefined
}

export function findCategoryBySlug(slug: string): CategoryRow | undefined {
  return getDb()
    .prepare('SELECT id, slug, name, sort_order FROM blog_categories WHERE slug = ?')
    .get(slug) as CategoryRow | undefined
}

export function insertCategory(category: {
  id: string
  slug: string
  name: string
  sortOrder: number
  createdAt: string
}): void {
  getDb()
    .prepare('INSERT INTO blog_categories (id, slug, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(category.id, category.slug, category.name, category.sortOrder, category.createdAt)
}
