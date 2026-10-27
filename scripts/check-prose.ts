import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Aika prose check.
 *
 * Refuses em dashes and en dashes anywhere in the repository. Use a comma,
 * a colon, a full stop, or parentheses instead. A plain hyphen is fine inside
 * words and ranges, such as R1-R6.
 *
 * Two reasons this is a build step rather than a style guideline:
 *
 *   1. A rule nobody enforces is a rule that decays. Same reasoning as
 *      `arch:check`.
 *   2. These characters are invisible in review. Nobody notices one being
 *      added, so nothing stops them coming back.
 *
 * Scope: EVERY file, not a list of extensions. An earlier version filtered by
 * extension and silently skipped `.gitignore`, `.gitattributes`, the `.env`
 * templates and `LICENSE`, which is how seven dashes survived a cleanup pass.
 * Files are now classified by content, not by name.
 *
 * The check is deliberately blunt: the characters are banned outright, in
 * every file, including this one.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.nuxt',
  '.output',
  'dist',
  'coverage',
  'backups',
])

/** Extensions we know are binary and would only produce noise. */
const BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.svgz',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.7z',
  '.node',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.db',
  '.db-wal',
  '.db-shm',
])

const EM_DASH = '\u2014'
const EN_DASH = '\u2013'

const violations: Array<{ file: string, line: number, detail: string }> = []
const skippedBinary: string[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(join(dir, entry.name), out)
    }
    else {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

/** A NUL byte in the first block means this is not text we should scan. */
function looksBinary(buffer: Buffer): boolean {
  const limit = Math.min(buffer.length, 8192)
  for (let index = 0; index < limit; index++) {
    if (buffer[index] === 0) return true
  }
  return false
}

for (const file of walk(root)) {
  if (!statSync(file).isFile()) continue

  const relFile = relative(root, file).split('\\').join('/')
  if (BINARY_EXTS.has(extname(file).toLowerCase())) continue

  const buffer = readFileSync(file)

  if (looksBinary(buffer)) {
    skippedBinary.push(relFile)
    continue
  }

  const source = buffer.toString('utf8')
  if (!source.includes(EM_DASH) && !source.includes(EN_DASH)) continue

  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index] ?? ''
    if (!text.includes(EM_DASH) && !text.includes(EN_DASH)) continue

    violations.push({
      file: relFile,
      line: index + 1,
      detail: `${text.includes(EM_DASH) ? 'em dash' : 'en dash'}: ${text.trim().slice(0, 90)}`,
    })
  }
}

if (violations.length === 0) {
  console.log(
    `prose:check passed: no em or en dashes across ${walk(root).length} files.`,
  )
  if (skippedBinary.length > 0) {
    console.log(`(${skippedBinary.length} binary file(s) skipped by content sniff)`)
  }
  process.exit(0)
}

console.error(`prose:check failed: ${violations.length} dash character(s) found.\n`)

for (const violation of violations) {
  console.error(`  ${violation.file}:${violation.line}`)
  console.error(`    ${violation.detail}\n`)
}

console.error('Replace each one with a comma, a colon, a full stop, or parentheses.')
console.error('A plain hyphen is still fine inside words and ranges, such as R1-R6.')

process.exit(1)
