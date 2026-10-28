import { Hono, type Context } from 'hono'
import { requireRole, requireUser } from '../../auth'
import { ValidationError } from '../../../shared/errors'
import {
  categoryInputSchema,
  categoryListResponseSchema,
  deletePostResponseSchema,
  postInputSchema,
  postListResponseSchema,
  postResponseSchema,
  staffPostListResponseSchema,
  staffPostResponseSchema,
} from '../contract'
import {
  createCategory,
  createPost,
  deletePost,
  getPublishedPost,
  getStaffPost,
  listCategories,
  listPublishedPosts,
  listStaffPosts,
  updatePostById,
} from './service'

/**
 * The blog feature's HTTP surface.
 *
 * TWO KINDS OF ROUTE, AND THE SPLIT IS THE WHOLE DESIGN.
 *
 *   Public:  the list and one post, published only. No guard, because a blog
 *            nobody can read is not a blog.
 *   Staff:   everything else, including drafts. Guarded, and publishing is
 *            administrator only because it is the step that makes words public.
 *
 * WHY THE GUARD IS PER ROUTE AND NOT A GROUP. This router serves both kinds, so a
 * `use` would have to be scoped twice as carefully as an inline call, and a
 * mistake in the scope is a draft visible to the whole internet. Each staff route
 * names its own guard as the first line instead.
 */
export const blogRoutes = new Hono()

/**
 * Public. Markdown is sent as Markdown and rendered on the server.
 *
 * Sending HTML from here would move the escaping guarantee into whichever
 * component called `v-html`, and one `v-html` with a post body is a stored XSS
 * waiting for whoever writes the next page.
 */
blogRoutes.get('/blog/posts', (c) => {
  const category = c.req.query('category')
  const page = Number(c.req.query('page') ?? '1')

  const { posts, hasMore } = listPublishedPosts({
    categorySlug: category === '' ? undefined : category,
    page,
  })

  return c.json(postListResponseSchema.parse({
    success: true,
    message: 'Published posts.',
    data: { posts, hasMore },
  }))
})

blogRoutes.get('/blog/posts/:slug', (c) => {
  const post = getPublishedPost(c.req.param('slug') ?? '')

  return c.json(postResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { post },
  }))
})

/** Public, because a category is shown in a post's header and on the list page. */
blogRoutes.get('/blog/categories', (c) => {
  return c.json(categoryListResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { categories: listCategories() },
  }))
})

/**
 * The staff list, drafts included, for any signed-in member of staff.
 *
 * `requireUser` rather than a role, because writing a draft is content work and
 * both roles do it. Seeing drafts is not the same as publishing them.
 */
blogRoutes.get('/blog/admin/posts', (c) => {
  requireUser(c)

  return c.json(staffPostListResponseSchema.parse({
    success: true,
    message: 'All posts.',
    data: { posts: listStaffPosts() },
  }))
})

blogRoutes.get('/blog/admin/posts/:id', (c) => {
  requireUser(c)

  return c.json(staffPostResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { post: getStaffPost(c.req.param('id') ?? '') },
  }))
})

/**
 * Creating and editing are open to both roles.
 *
 * The reasoning is the same as the media library: producing content is the job,
 * and an editor who cannot save a draft is an editor who cannot work. What is
 * restricted is `status: 'published'`, checked below, because publishing is the
 * act that puts words in front of the public rather than the act of typing them.
 */
blogRoutes.post('/blog/admin/posts', async (c) => {
  requireUser(c)

  const parsed = await readPostInput(c)

  /*
   * WHY THE CHECK IS HERE AND NOT A ROUTE GUARD. The same route creates a draft
   * and publishes a post: it is the payload that decides which, so the permission
   * depends on the body rather than on the path. A `roleGuard` cannot see a body.
   */
  requirePublishPermission(c, parsed.data.status)

  const post = createPost(parsed.data)

  return c.json(staffPostResponseSchema.parse({
    success: true,
    message: post.status === 'published' ? 'Published.' : 'Draft saved.',
    data: { post },
  }), 201)
})

blogRoutes.put('/blog/admin/posts/:id', async (c) => {
  requireUser(c)

  const parsed = await readPostInput(c)
  requirePublishPermission(c, parsed.data.status)

  const post = updatePostById(c.req.param('id') ?? '', parsed.data)

  return c.json(staffPostResponseSchema.parse({
    success: true,
    message: post.status === 'published' ? 'Saved and published.' : 'Saved as a draft.',
    data: { post },
  }))
})

/** Administrator only: deleting somebody else's published work is not content production. */
blogRoutes.delete('/blog/admin/posts/:id', (c) => {
  requireRole(c, 'admin')

  const id = deletePost(c.req.param('id') ?? '')

  return c.json(deletePostResponseSchema.parse({
    success: true,
    message: 'Deleted.',
    data: { id },
  }))
})

blogRoutes.post('/blog/admin/categories', async (c) => {
  requireRole(c, 'admin')

  const body = await c.req.json().catch(() => null)
  const parsed = categoryInputSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      'Please check the category and try again.',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    )
  }

  const category = createCategory(parsed.data)

  return c.json(categoryListResponseSchema.parse({
    success: true,
    message: 'Category created.',
    data: { categories: [category] },
  }), 201)
})

/**
 * Reads and validates a post body, in one place, because three handlers need it
 * and a second copy of this error message is a second copy of the rule.
 */
async function readPostInput(c: Context) {
  const body = await c.req.json().catch(() => null)
  const parsed = postInputSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      'Please check the post and try again.',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    )
  }

  return parsed
}

/**
 * Publishing needs an administrator. Saving a draft does not.
 *
 * Reading the role per request rather than trusting a flag, so a demotion takes
 * effect without anybody signing out.
 */
function requirePublishPermission(c: Context, status: 'draft' | 'published'): void {
  if (status === 'published') requireRole(c, 'admin')
}
