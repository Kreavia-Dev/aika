/**
 * Markdown to HTML, deliberately small.
 *
 * WHY NOT A LIBRARY. `marked`, `markdown-it`, and friends are good and this is
 * not an argument against them. The problem is that they ship a sanitiser
 * question: Markdown allows raw HTML, so a post containing `<script>` passes
 * through the renderer untouched unless a second library strips it, and getting
 * that pair right is exactly the kind of thing that silently regresses. This
 * renderer never emits a tag it did not construct, so there is nothing to strip
 * and no configuration to forget.
 *
 * WHY THAT IS ENOUGH HERE. The people typing Markdown are staff writing a client's
 * blog. They do not need embeds, HTML, or footnotes, and the whole file is smaller
 * than the README of the sanitiser it replaces. If a client genuinely needs raw
 * HTML in a post, that is a decision with a sanitiser attached rather than a
 * feature to slip in.
 *
 * WHAT IS SUPPORTED
 *
 *   headings      # to ######
 *   paragraphs    blank line separated
 *   emphasis      **bold**, *italic*, `code`
 *   links         [text](https://example.com)
 *   lists         - item, and 1. item
 *   quotes        > text
 *   rules         ---
 *   line breaks   two trailing spaces
 *
 * WHAT IS NOT SUPPORTED, AND WILL APPEAR AS LITERAL TEXT
 *
 *   raw HTML      escaped and shown, never interpreted
 *   images        `![alt](src)` renders as a link, because a post's images go
 *                 through the media library so they are resized and recorded
 *   tables, footnotes, task lists, syntax highlighting
 */

/**
 * Escapes the five characters that change meaning in HTML.
 *
 * `&` first, or the entities produced from the others would be double escaped and
 * a post about `a & b` would read `a &amp;amp; b`.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escapes text, then applies the inline rules.
 *
 * ORDER MATTERS. Escaping happens first so a `<script>` typed into a post becomes
 * text, and the inline replacements after it only ever see escaped input, so they
 * cannot be tricked into producing a tag from something the author typed.
 */
function renderInline(text: string): string {
  let out = escapeHtml(text)

  // Code spans first: their contents must not be further processed, so they are
  // taken out, replaced with a placeholder, and put back at the end.
  const codeSpans: string[] = []
  out = out.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(`<code>${code}</code>`)
    return `\u0000CODE${codeSpans.length - 1}\u0000`
  })

  /*
   * Links. Only `http`, `https`, and `mailto`, and only when the scheme is
   * spelled out. A relative link would be ambiguous in a post that is read at
   * several addresses, and `javascript:` is the one scheme that turns a link into
   * an execution primitive, so an unknown scheme stays text and is not a link.
   *
   * `rel="noopener noreferrer"` because the target is `_blank`: without it the
   * opened page can reach back through `window.opener`.
   */
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (_match, label: string, href: string) =>
      `<a href="${href}" rel="noopener noreferrer" target="_blank">${label}</a>`,
  )

  // Bold before italic, or `**bold**` becomes `<em>*bold*</em>`.
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')

  // A line ending in two spaces is a hard break. Trailing whitespace is stripped
  // by enough editors that this is a convenience rather than a guarantee.
  out = out.replace(/ {2,}\n/g, '<br>\n')

  return out.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => codeSpans[Number(index)] ?? '')
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []

  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    // Blank line: a separator, not content.
    if (line.trim() === '') {
      index++
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = (heading[1] ?? '#').length
      blocks.push(`<h${level}>${renderInline((heading[2] ?? '').trim())}</h${level}>`)
      index++
      continue
    }

    // A horizontal rule, before the list rules, because `---` also starts with a
    // character a list could claim.
    if (/^-{3,}$/.test(line.trim())) {
      blocks.push('<hr>')
      index++
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quoted.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index++
      }
      // One paragraph inside the quote. Nested quotes are not supported and would
      // produce a tag soup that reads worse than the literal text.
      blocks.push(`<blockquote><p>${renderInline(quoted.join('\n'))}</p></blockquote>`)
      continue
    }

    const unordered = /^[-*]\s+(.*)$/
    const ordered = /^\d+\.\s+(.*)$/

    if (unordered.test(line) || ordered.test(line)) {
      const isOrdered = ordered.test(line)
      const pattern = isOrdered ? ordered : unordered
      const items: string[] = []

      while (index < lines.length) {
        const current = lines[index] ?? ''
        const match = pattern.exec(current)
        if (!match) break
        items.push(`<li>${renderInline((match[1] ?? '').trim())}</li>`)
        index++
      }

      const tag = isOrdered ? 'ol' : 'ul'
      blocks.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }

    // Anything else is a paragraph, running until a blank line or the start of
    // another block.
    const paragraph: string[] = []

    while (index < lines.length) {
      const current = lines[index] ?? ''
      if (current.trim() === '') break
      if (/^(#{1,6})\s/.test(current)) break
      if (/^-{3,}$/.test(current.trim())) break
      if (/^>\s?/.test(current)) break
      if (unordered.test(current) || ordered.test(current)) break
      paragraph.push(current)
      index++
    }

    blocks.push(`<p>${renderInline(paragraph.join('\n').trim())}</p>`)
  }

  return blocks.join('\n')
}
