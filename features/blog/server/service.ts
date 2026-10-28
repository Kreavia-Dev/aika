import { randomUUID } from 'node:crypto'
import { ConflictError, NotFoundError } from '../../../shared/errors'
import { POSTS_PER_PAGE, type CategoryInput, type PostInput, type PublishedPost, type StaffPost } from '../contract'
import { renderMarkdown } from './markdown'
import {
  deletePostById,
  findAllPosts,
  findCategories,
  findCategoryById,
  findCategoryBySlug,
  findPostById,
  findPostBySlug,
  findPublishedPostBySlug,
  findPublishedPosts,
  hasPublishedPostsPast,
  insertCategory,
  insertPost,
  updatePost,
  type CategoryRow,
  type PostRow,
  type PublishedRow,
} from './repository'

/**
 * Blog business rules.
 *
 * The repository stores rows and this decides what they mean. Nothing here
 * touches HTTP, so the rules can be tested without a request.
 */

function toStaffPost(row: PostRow): StaffPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    coverMediaId: row.cover_media_id,
    categoryId: row.category_id,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCategory(row: CategoryRow) {
  return { id: row.id, slug: row.slug, name: row.name, sortOrder: row.sort_order }
}

/**
 * The public shape.
 *
 * `publishedAt` is non-null by construction: the queries that produce a
 * `PublishedRow` only return published posts, and publishing always sets a date.
 * The fallback exists because the type cannot express that, and an empty string
 * is a more honest last resort than a crash on a page nobody is watching.
 */
function toPublishedPost(row: PublishedRow): PublishedPost {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    // Rendered here, once, rather than in each page that shows a post.
    bodyHtml: renderMarkdown(row.body),
    coverUrl: row.cover_filename === null ? null : `/media/${row.cover_filename}`,
    category: row.category_slug === null || row.category_name === null
      ? null
      : { slug: row.category_slug, name: row.category_name },
    publishedAt: row.published_at ?? row.created_at,
  }
}

/**
 * One page of published posts.
 *
 * `page` is 1 based because it comes from a URL a person may have typed, and
 * `?page=0` reading as the first page is friendlier than an error. A negative or
 * non-numeric value is treated the same way rather than refused: a blog list is
 * not a form submission, and refusing an odd query string is a worse experience
 * than answering sensibly.
 */
export function listPublishedPosts(input: {
  categorySlug?: string
  page: number
}): { posts: PublishedPost[], hasMore: boolean } {
  const page = Number.isFinite(input.page) && input.page > 0 ? Math.floor(input.page) : 1
  const offset = (page - 1) * POSTS_PER_PAGE

  const rows = findPublishedPosts({
    categorySlug: input.categorySlug,
    limit: POSTS_PER_PAGE,
    offset,
  })

  const hasMore = hasPublishedPostsPast({
    categorySlug: input.categorySlug,
    offset: offset + POSTS_PER_PAGE,
  })

  return { posts: rows.map(toPublishedPost), hasMore }
}

export function getPublishedPost(slug: string): PublishedPost {
  const row = findPublishedPostBySlug(slug)
  if (!row) throw new NotFoundError('That post does not exist, or is not published yet.')
  return toPublishedPost(row)
}

export function listStaffPosts(): StaffPost[] {
  return findAllPosts().map(toStaffPost)
}

export function getStaffPost(id: string): StaffPost {
  const row = findPostById(id)
  if (!row) throw new NotFoundError('No post exists with that id.')
  return toStaffPost(row)
}

export function listCategories() {
  return findCategories().map(toCategory)
}

export function createCategory(input: CategoryInput) {
  if (findCategoryBySlug(input.slug)) {
    throw new ConflictError(`A category already uses the address "${input.slug}".`)
  }

  const id = randomUUID()
  insertCategory({
    id,
    slug: input.slug,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date().toISOString(),
  })

  const row = findCategoryById(id)
  if (!row) throw new Error('Category insert did not persist. This should be impossible.')
  return toCategory(row)
}

/**
 * Rejects a reference that does not exist, before it becomes a foreign key error.
 *
 * A nullable reference to something that is not there is a bug in the caller, and
 * "FOREIGN KEY constraint failed" at 500 is a poor way to tell a staff member
 * that the category they picked has been deleted.
 */
function assertCategoryExists(categoryId: string | null | undefined): string | null {
  if (categoryId === null || categoryId === undefined) return null
  if (!findCategoryById(categoryId)) throw new NotFoundError('That category no longer exists.')
  return categoryId
}

export function createPost(input: PostInput): StaffPost {
  if (findPostBySlug(input.slug)) {
    throw new ConflictError(`A post already uses the address "${input.slug}".`)
  }

  const now = new Date().toISOString()
  const id = randomUUID()

  insertPost({
    id,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    body: input.body,
    coverMediaId: input.coverMediaId ?? null,
    categoryId: assertCategoryExists(input.categoryId),
    status: input.status,
    // Set on creation only when it is created as published. A draft has no date,
    // because a draft that says when it was published is a lie in a list.
    publishedAt: input.status === 'published' ? now : null,
    createdAt: now,
    updatedAt: now,
  })

  const row = findPostById(id)
  if (!row) throw new Error('Post insert did not persist. This should be impossible.')
  return toStaffPost(row)
}

export function updatePostById(id: string, input: PostInput): StaffPost {
  const existing = findPostById(id)
  if (!existing) throw new NotFoundError('No post exists with that id.')

  /*
   * A slug change is refused when it would collide with a different post. Checking
   * against the existing slug first is what allows saving a post without renaming
   * it, which would otherwise look like a conflict with itself.
   */
  const collision = findPostBySlug(input.slug)
  if (collision && collision.id !== id) {
    throw new ConflictError(`Another post already uses the address "${input.slug}".`)
  }

  /*
   * The published date is set once, on the transition out of draft, and never
   * moved afterwards. Re-publishing an edited post should not make it jump to the
   * top of the list, because that would let anybody reorder a blog by saving it.
   * Unpublishing clears it and publishing again starts a fresh date, which is the
   * only case where it reads as a new post.
   */
  const publishedAt = input.status === 'published'
    ? existing.published_at ?? new Date().toISOString()
    : null

  updatePost({
    id,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    body: input.body,
    coverMediaId: input.coverMediaId ?? null,
    categoryId: assertCategoryExists(input.categoryId),
    status: input.status,
    publishedAt,
    updatedAt: new Date().toISOString(),
  })

  const row = findPostById(id)
  if (!row) throw new Error('Post update did not persist. This should be impossible.')
  return toStaffPost(row)
}

export function deletePost(id: string): string {
  const removed = deletePostById(id)
  if (removed === 0) throw new NotFoundError('No post exists with that id.')
  return id
}
