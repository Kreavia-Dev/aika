import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../server/markdown'

/**
 * Markdown to HTML.
 *
 * The output goes into `v-html` on a public page, so every test here is about two
 * things at once: that the syntax a staff member expects produces the markup a
 * reader expects, and that nothing a staff member types can become a tag this
 * renderer did not build itself.
 */
describe('renderMarkdown: what it supports', () => {
  it('renders headings at every level', () => {
    expect(renderMarkdown('# One')).toBe('<h1>One</h1>')
    expect(renderMarkdown('### Three')).toBe('<h3>Three</h3>')
    expect(renderMarkdown('###### Six')).toBe('<h6>Six</h6>')
  })

  it('renders paragraphs and keeps a single newline inside one', () => {
    const html = renderMarkdown('First line\nsecond line.')

    expect(html).toBe('<p>First line\nsecond line.</p>')
  })

  it('separates blocks on a blank line', () => {
    expect(renderMarkdown('One\n\nTwo')).toBe('<p>One</p>\n<p>Two</p>')
  })

  it('renders bold and italic, and bold wins over italic', () => {
    // The order matters: naively replacing italic first produces `<em>*bold*</em>`.
    expect(renderMarkdown('**strong**')).toBe('<p><strong>strong</strong></p>')
    expect(renderMarkdown('*soft*')).toBe('<p><em>soft</em></p>')
  })

  it('renders a link, and opens it safely', () => {
    /*
     * `rel="noopener noreferrer"` because the target is `_blank`: without it the
     * opened page can reach back through `window.opener` and replace this one.
     */
    expect(renderMarkdown('[Aika](https://example.com)')).toBe(
      '<p><a href="https://example.com" rel="noopener noreferrer" target="_blank">Aika</a></p>',
    )
  })

  it('renders an unordered list', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  it('renders an ordered list', () => {
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
  })

  it('renders a quote', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>')
  })

  it('renders a rule', () => {
    expect(renderMarkdown('---')).toBe('<hr>')
  })

  it('renders a code span, and does not interpret what is inside it', () => {
    // The point of a code span is to show characters literally.
    expect(renderMarkdown('Use `<strong>` here')).toBe('<p>Use <code>&lt;strong&gt;</code> here</p>')
  })

  it('preserves a hard break', () => {
    expect(renderMarkdown('one  \ntwo')).toBe('<p>one<br>\ntwo</p>')
  })
})

describe('renderMarkdown: what it refuses', () => {
  it('escapes a script tag instead of emitting it', () => {
    /*
     * THE TEST THIS FILE EXISTS FOR. A post is written by staff, but staff
     * accounts get compromised and a client may one day give an account to
     * somebody they should not have. If this ever returns a real `<script>`, every
     * reader of that post runs whatever it contains.
     */
    const html = renderMarkdown('<script>alert(1)</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes an image tag with an onerror handler', () => {
    // The classic one, via an HTML tag rather than the Markdown image syntax.
    const html = renderMarkdown('<img src=x onerror="alert(1)">')

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('refuses a javascript: link, leaving it as text', () => {
    /*
     * The one scheme that turns a link into an execution primitive. An unknown
     * scheme is not a link at all: better a reader sees the syntax than a browser
     * treats it as an instruction.
     */
    const html = renderMarkdown('[click](javascript:alert(1))')

    expect(html).not.toContain('href')
    expect(html).not.toContain('<a')
  })

  it('escapes an ampersand exactly once', () => {
    // Escaping `&` last would double escape everything produced before it.
    expect(renderMarkdown('a & b')).toBe('<p>a &amp; b</p>')
  })

  it('escapes quotes inside a paragraph', () => {
    expect(renderMarkdown('he said "hi"')).toContain('&quot;')
  })

  it('does not render the Markdown image syntax as an image tag', () => {
    /*
     * Deliberate. A post's images go through the media library, which resizes
     * them and records them, so nothing in a post needs to point at an arbitrary
     * URL that the site does not control.
     */
    const html = renderMarkdown('![alt](https://example.com/x.png)')

    expect(html).not.toContain('<img')
  })

  it('does not treat a hash in the middle of a line as a heading', () => {
    expect(renderMarkdown('a # b')).toBe('<p>a # b</p>')
  })
})
