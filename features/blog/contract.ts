import { z } from 'zod'

/**
 * The `blog` feature's public contract.
 *
 * Same split as `contact`: the plumbing and the staff screen are Aika's, and the
 * public pages are here too because a blog list is tooling shaped rather than
 * branding shaped. A client restyles them, but every client wants the same three
 * pages: a list, a post, and a way to write one.
 */

/**
 * Where a post is in its life.
 *
 * Two values now, and a text column rather than a boolean so a third can be added
 * without a migration. `scheduled` is the obvious next one.
 */
export const postStatusSchema = z.enum(['draft', 'published'])

/**
 * A URL segment.
 *
 * Lowercase letters, digits, and single hyphens. Deliberately strict: a slug ends
 * up in a URL, in a canonical tag, and in whatever a search engine decides to do
 * with it, and a slug with a space or a question mark in it is a bug that shows
 * up in somebody else's browser rather than in the test suite.
 *
 * No leading or trailing hyphen, and no doubled hyphen, because those read as a
 * typo in a URL that people do occasionally type by hand.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits, and single hyphens.')

/**
 * What a staff member submits when writing a post.
 *
 * `coverMediaId` is an id rather than a URL, so a post points at the record and
 * the record owns the address. Deleting the image then nulls the reference
 * instead of leaving a broken `<img>` nobody can trace.
 */
export const postInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  // A minimum, because the summary is the meta description, and one word of it
  // is worse than none: search engines fall back to page content when a
  // description is absent, and to nothing useful when it is a stub.
  summary: z.string().trim().min(20).max(320),
  body: z.string().trim().min(1).max(100_000),
  coverMediaId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  status: postStatusSchema,
})

export const categoryInputSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

/**
 * A post as the public pages receive it.
 *
 * No `status` and no `updatedAt`. A published page has no use for either, and a
 * field that is never read is a field that eventually leaks.
 *
 * The body arrives as `bodyHtml`, not as the Markdown a staff member typed. The
 * conversion happens on the server, through a renderer that escapes its input and
 * only emits tags it builds itself, so a page can render it with `v-html` without
 * that page becoming the place where sanitising is supposed to happen. Sending
 * Markdown instead would push the escaping question into every consumer.
 */
export const publishedPostSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  bodyHtml: z.string(),
  coverUrl: z.string().nullable(),
  category: z.object({ slug: z.string(), name: z.string() }).nullable(),
  publishedAt: z.string(),
})

/** A post as the staff screens receive it, which is everything. */
export const staffPostSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  coverMediaId: z.string().nullable(),
  categoryId: z.string().nullable(),
  status: postStatusSchema,
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
})

export const postListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    posts: z.array(publishedPostSchema),
    /**
     * Whether there is at least one more post past this page.
     *
     * A total count is tempting and costs a second query on every page view. The
     * only thing the reader does with a count is decide whether to ask for the
     * next page, and this answers exactly that.
     */
    hasMore: z.boolean(),
  }),
})

export const postResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ post: publishedPostSchema }),
})

export const staffPostListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ posts: z.array(staffPostSchema) }),
})

export const staffPostResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ post: staffPostSchema }),
})

export const categoryListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ categories: z.array(categorySchema) }),
})

/** Deleting returns the id, not the post: there is nothing left to return. */
export const deletePostResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ id: z.string() }),
})

/**
 * Where an old address moved to.
 *
 * `null` covers every case that is not a redirect: an address that never existed,
 * one belonging to a draft, and one whose post is published here right now. The
 * page cannot tell those apart and does not need to.
 */
export const movedResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ movedTo: z.string().nullable() }),
})

/**
 * How many posts one public page holds.
 *
 * Shared with the browser so the list page can lay out what it asked for without
 * a second copy of the number.
 */
export const POSTS_PER_PAGE = 10

export type PostStatus = z.infer<typeof postStatusSchema>
export type PostInput = z.infer<typeof postInputSchema>
export type CategoryInput = z.infer<typeof categoryInputSchema>
export type PublishedPost = z.infer<typeof publishedPostSchema>
export type StaffPost = z.infer<typeof staffPostSchema>
export type Category = z.infer<typeof categorySchema>
export type PostListResponse = z.infer<typeof postListResponseSchema>
export type PostResponse = z.infer<typeof postResponseSchema>
export type StaffPostListResponse = z.infer<typeof staffPostListResponseSchema>
export type StaffPostResponse = z.infer<typeof staffPostResponseSchema>
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>
export type DeletePostResponse = z.infer<typeof deletePostResponseSchema>
export type MovedResponse = z.infer<typeof movedResponseSchema>
