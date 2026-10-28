import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { failureEnvelopeSchema } from '../../../shared/http/envelope'
import { createUser } from '../../auth'
import {
  categoryListResponseSchema,
  deletePostResponseSchema,
  postListResponseSchema,
  postResponseSchema,
  staffPostListResponseSchema,
  staffPostResponseSchema,
} from '../contract'
import { createCategory, createPost } from '../server/service'

/**
 * Blog endpoints and the rules around publishing.
 *
 * Drives the real Hono app in process, the same way the other suites do. The
 * database is emptied once per file, so tests create what they need rather than
 * assuming an empty table.
 */
const PASSWORD = 'a password long enough to be hashed without complaint'

async function signIn(role: 'admin' | 'editor'): Promise<string> {
  const email = `blog-${role}-${randomUUID()}@example.com`
  await createUser({ email, password: PASSWORD, role })

  const response = await api.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })

  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

function uniqueSlug(prefix = 'post'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

const VALID_POST = {
  title: 'A post about something',
  summary: 'A summary that is long enough to satisfy the minimum length rule.',
  body: '# Heading\n\nSome **markdown** body.',
  status: 'draft' as const,
}

async function postAs(cookie: string | undefined, body: unknown): Promise<Response> {
  return api.request('/api/blog/admin/posts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: JSON.stringify(body),
  })
}

async function listAs(cookie: string | undefined): Promise<Response> {
  return api.request('/api/blog/admin/posts', {
    headers: cookie === undefined ? {} : { cookie },
  })
}

describe('writing a post', () => {
  it('refuses a signed out visitor', async () => {
    // Nothing between the internet and a client's drafts except this.
    const response = await postAs(undefined, { ...VALID_POST, slug: uniqueSlug() })

    expect(response.status).toBe(401)
  })

  it('lets an editor save a draft', async () => {
    /*
     * The central rule of this feature. An editor who cannot save a draft is an
     * editor who cannot work, and restricting drafts would make the role useless
     * for the job it exists for.
     */
    const cookie = await signIn('editor')

    const response = await postAs(cookie, { ...VALID_POST, slug: uniqueSlug() })

    expect(response.status).toBe(201)

    const body = staffPostResponseSchema.parse(await response.json())
    expect(body.data.post.status).toBe('draft')
    expect(body.data.post.publishedAt).toBeNull()
  })

  it('refuses to let an editor publish', async () => {
    /*
     * The other half. Publishing is the act that puts words in front of the
     * public, and it is the one thing the role check exists for.
     */
    const cookie = await signIn('editor')

    const response = await postAs(cookie, { ...VALID_POST, slug: uniqueSlug(), status: 'published' })

    expect(response.status).toBe(403)

    const body = failureEnvelopeSchema.parse(await response.json())
    expect(body.code).toBe('FORBIDDEN')
  })

  it('lets an administrator publish, and records the date', async () => {
    const cookie = await signIn('admin')

    const response = await postAs(cookie, { ...VALID_POST, slug: uniqueSlug(), status: 'published' })

    expect(response.status).toBe(201)

    const body = staffPostResponseSchema.parse(await response.json())
    expect(body.data.post.status).toBe('published')
    expect(body.data.post.publishedAt).not.toBeNull()
  })

  it('refuses a duplicate slug with a conflict rather than a crash', async () => {
    // A UNIQUE constraint error would be a 500 and an unreadable message.
    const cookie = await signIn('admin')
    const slug = uniqueSlug()

    await postAs(cookie, { ...VALID_POST, slug })

    const response = await postAs(cookie, { ...VALID_POST, slug, title: 'A different title' })

    expect(response.status).toBe(409)
  })

  it('refuses a slug that is not URL safe', async () => {
    const cookie = await signIn('admin')

    const response = await postAs(cookie, { ...VALID_POST, slug: 'Not A Slug' })

    expect(response.status).toBe(422)
  })

  it('refuses a summary that is too short to be a meta description', async () => {
    const cookie = await signIn('admin')

    const response = await postAs(cookie, { ...VALID_POST, slug: uniqueSlug(), summary: 'short' })

    expect(response.status).toBe(422)
  })
})

describe('the public list', () => {
  it('shows a published post and never shows a draft', async () => {
    /*
     * The test that would catch the worst possible bug in this feature: a draft
     * appearing on the public blog because a query forgot its status filter.
     */
    const draftSlug = uniqueSlug('draft')
    const liveSlug = uniqueSlug('live')

    await createPost({ ...VALID_POST, slug: draftSlug })
    const admin = await signIn('admin')
    await postAs(admin, { ...VALID_POST, slug: liveSlug, status: 'published' })

    const response = await api.request('/api/blog/posts')
    const body = postListResponseSchema.parse(await response.json())

    const slugs = body.data.posts.map(post => post.slug)
    expect(slugs).toContain(liveSlug)
    expect(slugs).not.toContain(draftSlug)
  })

  it('works without a session, because a blog nobody can read is not a blog', async () => {
    expect((await api.request('/api/blog/posts')).status).toBe(200)
  })

  it('sends rendered HTML rather than the Markdown that was typed', async () => {
    /*
     * The body is converted on the server so that no page has to decide how to
     * render it, and so the escaping happens in one place rather than in each
     * consumer.
     */
    const slug = uniqueSlug('html')
    const admin = await signIn('admin')
    await postAs(admin, { ...VALID_POST, slug, body: '# Heading\n\nText with **weight**.', status: 'published' })

    const response = await api.request(`/api/blog/posts/${slug}`)
    const body = postResponseSchema.parse(await response.json())

    expect(body.data.post.bodyHtml).toContain('<h1>Heading</h1>')
    expect(body.data.post.bodyHtml).toContain('<strong>weight</strong>')
  })

  it('escapes a script tag inside a published post', async () => {
    /*
     * End to end, through the API, because the unit test proves the renderer and
     * this proves the renderer is actually the thing producing the response.
     */
    const slug = uniqueSlug('xss')
    const admin = await signIn('admin')
    await postAs(admin, { ...VALID_POST, slug, body: '<script>alert(1)</script>', status: 'published' })

    const response = await api.request(`/api/blog/posts/${slug}`)
    const body = postResponseSchema.parse(await response.json())

    expect(body.data.post.bodyHtml).not.toContain('<script>')
  })

  it('answers 404 for a draft, even when its slug is known', async () => {
    // Knowing the address of a draft must not be a way to read it.
    const slug = uniqueSlug('hidden')
    await createPost({ ...VALID_POST, slug })

    const response = await api.request(`/api/blog/posts/${slug}`)

    expect(response.status).toBe(404)
  })

  it('filters by category, and reports whether there is more', async () => {
    const category = createCategory({ slug: uniqueSlug('cat'), name: 'Engineering' })
    const admin = await signIn('admin')
    const slug = uniqueSlug('in-cat')

    await postAs(admin, {
      ...VALID_POST,
      slug,
      status: 'published',
      categoryId: category.id,
    })

    const response = await api.request(`/api/blog/posts?category=${category.slug}`)
    const body = postListResponseSchema.parse(await response.json())

    expect(body.data.posts.map(post => post.slug)).toEqual([slug])
    expect(typeof body.data.hasMore).toBe('boolean')
  })

  it('treats a nonsense page number as the first page', async () => {
    // A blog list is not a form submission, and refusing `?page=abc` helps nobody.
    for (const value of ['0', '-3', 'abc', '']) {
      const response = await api.request(`/api/blog/posts?page=${value}`)
      expect(response.status).toBe(200)
    }
  })
})

describe('the staff list', () => {
  it('shows drafts to a signed in editor', async () => {
    // The counterpart to hiding them publicly: staff must be able to find their
    // own unfinished work.
    const cookie = await signIn('editor')

    const response = await listAs(cookie)

    expect(response.status).toBe(200)
    staffPostListResponseSchema.parse(await response.json())
  })

  it('refuses a signed out visitor', async () => {
    expect((await listAs(undefined)).status).toBe(401)
  })
})

describe('editing and deleting', () => {
  it('keeps the original publication date when a published post is saved again', async () => {
    /*
     * A post must not jump to the top of the blog every time somebody fixes a
     * typo, because that would let anybody reorder the site by editing it.
     */
    const admin = await signIn('admin')
    const slug = uniqueSlug('revisit')

    const created = staffPostResponseSchema.parse(
      await (await postAs(admin, { ...VALID_POST, slug, status: 'published' })).json(),
    )

    const response = await api.request(`/api/blog/admin/posts/${created.data.post.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: admin },
      body: JSON.stringify({ ...VALID_POST, slug, title: 'Fixed a typo', status: 'published' }),
    })

    const updated = staffPostResponseSchema.parse(await response.json())
    expect(updated.data.post.publishedAt).toBe(created.data.post.publishedAt)
  })

  it('refuses to rename a post onto another post\'s address', async () => {
    const admin = await signIn('admin')
    const first = uniqueSlug('first')
    const second = uniqueSlug('second')

    await postAs(admin, { ...VALID_POST, slug: first })
    const created = staffPostResponseSchema.parse(
      await (await postAs(admin, { ...VALID_POST, slug: second })).json(),
    )

    const response = await api.request(`/api/blog/admin/posts/${created.data.post.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: admin },
      body: JSON.stringify({ ...VALID_POST, slug: first }),
    })

    expect(response.status).toBe(409)
  })

  it('refuses delete to an editor and allows it to an administrator', async () => {
    /*
     * Deleting somebody else's published work is not content production, so it
     * follows the same rule as publishing rather than the one that applies to
     * saving a draft.
     */
    const admin = await signIn('admin')
    const editor = await signIn('editor')

    const created = staffPostResponseSchema.parse(
      await (await postAs(admin, { ...VALID_POST, slug: uniqueSlug('del') })).json(),
    )

    const asEditor = await api.request(`/api/blog/admin/posts/${created.data.post.id}`, {
      method: 'DELETE',
      headers: { cookie: editor },
    })
    expect(asEditor.status).toBe(403)

    const asAdmin = await api.request(`/api/blog/admin/posts/${created.data.post.id}`, {
      method: 'DELETE',
      headers: { cookie: admin },
    })
    expect(asAdmin.status).toBe(200)

    const body = deletePostResponseSchema.parse(await asAdmin.json())
    expect(body.data.id).toBe(created.data.post.id)
  })
})

describe('categories', () => {
  it('lists them without a session, because a post shows its category', async () => {
    const response = await api.request('/api/blog/categories')

    expect(response.status).toBe(200)
    categoryListResponseSchema.parse(await response.json())
  })

  it('refuses a category created by an editor', async () => {
    // Categories are structure, and structure is administration.
    const editor = await signIn('editor')

    const response = await api.request('/api/blog/admin/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: editor },
      body: JSON.stringify({ slug: uniqueSlug('cat'), name: 'Editor made this' }),
    })

    expect(response.status).toBe(403)
  })
})
