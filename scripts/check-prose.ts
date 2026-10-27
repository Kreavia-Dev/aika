import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Aika writing check. Two rules, one gate.
 *
 * Rule 1, everywhere: no em dashes and no en dashes. Use a comma, a colon, a
 * full stop, or parentheses. A plain hyphen is fine inside words and ranges,
 * such as R1-R6.
 *
 * Rule 2, in framework code: no Indonesian. Code is English, always. Only the
 * client-facing surfaces, `app/**` and `features/<name>/web/**`, are exempt,
 * because client copy in a client project is legitimately Indonesian and the
 * language of a client's site is a per-client decision.
 *
 * Why a script rather than a note in a document:
 *
 *   1. A rule nobody enforces is a rule that decays.
 *   2. Dash characters are invisible in review. Nobody notices one being added.
 *   3. Mixed-language code reads badly for the humans, and worse for the tools
 *      and agents that have to reason about it.
 *
 * Scope note: the dash rule scans EVERY file, not a list of extensions. An
 * earlier version filtered by extension and silently skipped `.gitignore`,
 * `.gitattributes`, the `.env` templates and `LICENSE`, which is how seven
 * dashes survived a cleanup pass. Files are classified by content, not by name.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const selfPath = relative(root, fileURLToPath(import.meta.url)).split('\\').join('/')

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
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svgz',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.7z',
  '.node', '.exe', '.dll', '.so', '.dylib',
  '.db', '.db-wal', '.db-shm',
])

const EM_DASH = '\u2014'
const EN_DASH = '\u2013'

/**
 * Indonesian words that are unambiguously not English.
 *
 * Curated tightly, and deliberately short. An earlier version of this list
 * included `route`, which is an English word, and produced a screen of false
 * positives. A noisy check is worse than no check, because people learn to
 * ignore it.
 */
const INDONESIAN_WORDS = [
  'yang', 'dan', 'atau', 'untuk', 'dari', 'dengan', 'tidak', 'bukan',
  'adalah', 'kalau', 'sudah', 'belum', 'harus', 'bisa', 'juga', 'saja',
  'karena', 'supaya', 'milik', 'punya', 'pada', 'dalam', 'akan', 'kita',
  'kamu', 'saya', 'mereka', 'semua', 'hanya', 'lebih', 'paling', 'perlu',
  'jalankan', 'catatan', 'halaman', 'nama', 'tiap', 'masih', 'sambil',
  'tulis', 'periksa', 'pastikan', 'sesudah', 'berhasil', 'gagal',
  'disetujui', 'diterjemahkan', 'diperbarui', 'dijalankan', 'diulang',
  'menyentuh', 'tercantum', 'alasannya', 'justifikasinya', 'impor',
  'klien', 'batas', 'fitur', 'dokumen', 'bahasa', 'versi',
]

/**
 * Framework code: written once, merged into every client project, and read by
 * anyone opening the repository. This is where English is not negotiable.
 *
 * Exempt on purpose: `app/**` and `features/<name>/web/**`. Those are the
 * client-facing surfaces, and a client site written for Indonesian readers will
 * legitimately contain Indonesian copy.
 */
function isFrameworkCode(relFile: string): boolean {
  const parts = relFile.split('/')

  if (parts[0] === 'shared' || parts[0] === 'scripts') return true
  if (parts[0] === 'modules' || parts[0] === 'server' || parts[0] === 'tests') return true

  // features/<name>/contract.ts, index.ts, server/**, tests/**
  if (parts[0] === 'features' && parts.length >= 3) {
    const rest = parts.slice(2).join('/')
    return rest === 'contract.ts'
      || rest === 'index.ts'
      || rest.startsWith('server/')
      || rest.startsWith('tests/')
  }

  return false
}

const violations: Array<{ file: string, line: number, detail: string }> = []

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

const allFiles = walk(root)
const wordPattern = new RegExp(`\\b(${INDONESIAN_WORDS.join('|')})\\b`, 'i')

for (const file of walk(root)) {
  if (!statSync(file).isFile()) continue

  const relFile = relative(root, file).split('\\').join('/')
  if (BINARY_EXTS.has(extname(file).toLowerCase())) continue
  // This file contains the word list itself, so it would always match.
  if (relFile === selfPath) continue

  const buffer = readFileSync(file)
  if (looksBinary(buffer)) continue

  const source = buffer.toString('utf8')
  const checkIndonesian = isFrameworkCode(relFile)
  const lines = source.split('\n')

  for (let index = 0; index < lines.length; index++) {
    const text = lines[index] ?? ''

    if (text.includes(EM_DASH) || text.includes(EN_DASH)) {
      violations.push({
        file: relFile,
        line: index + 1,
        detail: `${text.includes(EM_DASH) ? 'em dash' : 'en dash'}: ${text.trim().slice(0, 80)}`,
      })
    }

    if (!checkIndonesian) continue

    const match = text.match(wordPattern)
    if (match) {
      violations.push({
        file: relFile,
        line: index + 1,
        detail: `Indonesian word "${match[0]}". Code is English: ${text.trim().slice(0, 80)}`,
      })
    }
  }
}

if (violations.length === 0) {
  console.log(
    `prose:check passed: no dashes across ${allFiles.length} files, no Indonesian in framework code.`,
  )
  process.exit(0)
}

console.error(`prose:check failed: ${violations.length} violation(s).\n`)

for (const violation of violations) {
  console.error(`  ${violation.file}:${violation.line}`)
  console.error(`    ${violation.detail}\n`)
}

console.error('Dashes: use a comma, a colon, a full stop, or parentheses.')
console.error('A plain hyphen is fine inside words and ranges, such as R1-R6.')
console.error('Indonesian in framework code: write it in English. Client UI under')
console.error('`app/` and `features/<name>/web/` is exempt.')

process.exit(1)
