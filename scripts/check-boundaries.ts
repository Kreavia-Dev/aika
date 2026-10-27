import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Aika architecture check: the enforcement half of docs/aika/ARCHITECTURE.md.
 *
 * This is a heuristic lint over source text, not a compiler. It reads import
 * specifiers with a regex, so a specifier built from a template string can
 * fool it. It catches the mistakes people actually make.
 *
 * Rules:
 *   R1  Every feature has `contract.ts` and `index.ts`; a feature with a
 *       `web/` directory also has `web/index.ts`.
 *   R2  Cross-feature imports resolve to `index.ts` or `web/index.ts` only.
 *   R3  Features never import from `app/`.
 *   R4  Features never open SQLite directly.
 *   R5  The feature dependency graph is acyclic.
 *   R6  Browser code (`features/*\/web/**`) never imports server-only modules.
 *   R7  `app/layouts/` is wired: `app/app.vue` wraps `NuxtPage` in `NuxtLayout`.
 *   R8  Top level directories match the map printed in `docs/aika/README.md`.
 *
 * Why this exists: Aika is distributed by `git pull upstream` into client
 * projects. That only stays mergeable while the framework/client boundary is
 * real, and it only stays *correct* while the server/browser boundary is real.
 * This script keeps both honest. There is no `nara doctor` here, just the
 * rules that matter, and they are deliberately few.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const featuresDir = join(root, 'features')
const appDir = join(root, 'app')

/** The only cross-feature import paths that are legal. */
const ALLOWED_CROSS_FEATURE_DOORS = new Set(['', 'index', 'web', 'web/index'])

const violations: Array<{ file: string, message: string }> = []
const featureSet = new Set<string>()
const edges = new Map<string, Set<string>>()

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.nuxt') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listSourceFiles(full))
    else if (/\.(ts|vue)$/.test(entry)) out.push(full)
  }
  return out
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function importSpecifiers(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1]
    if (specifier) found.add(specifier)
  }
  return [...found]
}

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  if (/^(~~|@|~)\//.test(specifier)) {
    return resolve(root, specifier.replace(/^(~~|@|~)\//, ''))
  }
  if (specifier.startsWith('.')) {
    return resolve(dirname(fromFile), specifier)
  }
  return null
}

function featureRef(absPath: string): { feature: string, sub: string } | null {
  const rel = relative(featuresDir, absPath)
  if (rel === '' || rel.startsWith('..')) return null

  const parts = rel.split(/[\\/]/)
  const feature = parts[0]
  if (!feature) return null

  return { feature, sub: parts.slice(1).join('/') }
}

/**
 * R6: anything that cannot run in a browser.
 *
 * `shared/database` is matched by a path fragment because feature code reaches
 * it through a relative path (`../../../shared/database/client`).
 */
function isServerOnly(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true
  if (specifier === 'better-sqlite3') return true
  if (/(^|\/)shared\/database(\/|$)/.test(specifier)) return true
  if (/(^|\/)server(\/|$)/.test(specifier)) return true
  return false
}

// ── R1 ───────────────────────────────────────────────────────────────────────
if (!existsSync(featuresDir)) {
  console.log('No features/ directory yet. Nothing to check.')
  process.exit(0)
}

const features = readdirSync(featuresDir).filter(name =>
  statSync(join(featuresDir, name)).isDirectory(),
)

for (const feature of features) {
  featureSet.add(feature)
  edges.set(feature, new Set())

  for (const required of ['contract.ts', 'index.ts']) {
    if (!existsSync(join(featuresDir, feature, required))) {
      violations.push({
        file: `features/${feature}`,
        message: `R1: missing required file \`${required}\``,
      })
    }
  }

  const webDir = join(featuresDir, feature, 'web')
  if (existsSync(webDir) && !existsSync(join(webDir, 'index.ts'))) {
    violations.push({
      file: `features/${feature}/web`,
      message: 'R1, has a `web/` directory but no browser-safe `web/index.ts` boundary',
    })
  }
}

// ── R2-R3, R4-R6 ───────────────────────────────────────────────────────────
for (const feature of features) {
  for (const file of listSourceFiles(join(featuresDir, feature))) {
    const relFile = relative(root, file).split(/[\\/]/).join('/')
    const relToFeature = relative(featuresDir, file).split(/[\\/]/).join('/')
    const isBrowserCode = relToFeature.startsWith(`${feature}/web/`)

    const source = stripComments(readFileSync(file, 'utf8'))

    for (const specifier of importSpecifiers(source)) {
      if (specifier === 'better-sqlite3') {
        violations.push({
          file: relFile,
          message: 'R4, opens SQLite directly; import from shared/database/client instead',
        })
      }

      if (isBrowserCode && isServerOnly(specifier)) {
        violations.push({
          file: relFile,
          message: `R6: browser code imports server-only \`${specifier}\`; it would be bundled for the client`,
        })
      }

      const abs = resolveSpecifier(specifier, file)
      if (!abs) continue

      if (!relative(appDir, abs).startsWith('..')) {
        violations.push({
          file: relFile,
          message: `R3: imports browser shell code \`${specifier}\`; features must not depend on app/`,
        })
      }

      const ref = featureRef(abs)
      if (!ref) continue
      if (ref.feature === feature) continue

      edges.get(feature)?.add(ref.feature)

      if (!ALLOWED_CROSS_FEATURE_DOORS.has(ref.sub)) {
        violations.push({
          file: relFile,
          message: `R2: deep cross-feature import \`${specifier}\`; use features/${ref.feature} or features/${ref.feature}/web`,
        })
      }
    }
  }
}

// ── R5 ───────────────────────────────────────────────────────────────────────
const WHITE = 0
const GRAY = 1
const BLACK = 2

const color = new Map<string, number>([...featureSet].map(name => [name, WHITE]))
const stack: string[] = []
const cycles: string[][] = []

function visit(node: string): void {
  color.set(node, GRAY)
  stack.push(node)

  for (const next of edges.get(node) ?? []) {
    if (color.get(next) === GRAY) {
      const start = stack.indexOf(next)
      cycles.push([...stack.slice(start), next])
    }
    else if (color.get(next) === WHITE) {
      visit(next)
    }
  }

  stack.pop()
  color.set(node, BLACK)
}

for (const feature of featureSet) {
  if (color.get(feature) === WHITE) visit(feature)
}

for (const cycle of cycles) {
  violations.push({
    file: 'features',
    message: `R5: dependency cycle: ${cycle.join(' -> ')}`,
  })
}

// ── R7 ───────────────────────────────────────────────────────────────────────
/**
 * `app/layouts/` only does anything if `app/app.vue` asks for it.
 *
 * Without the `NuxtLayout` wrapper, Nuxt renders every page and silently ignores
 * every layout. No warning, no error: `definePageMeta({ layout: ... })` simply
 * does nothing, and the page looks fine, just wrong. Aika shipped that way until
 * the site layout was built, which is why this is a rule rather than a note in a
 * document.
 *
 * HTML comments and `<script>` blocks are removed before looking, so a file that
 * only mentions NuxtLayout in prose still fails.
 */
const layoutsDir = join(appDir, 'layouts')

if (existsSync(layoutsDir) && readdirSync(layoutsDir).some(entry => entry.endsWith('.vue'))) {
  const appVuePath = join(appDir, 'app.vue')
  const appVueSource = existsSync(appVuePath) ? readFileSync(appVuePath, 'utf8') : ''

  const appVueTemplate = appVueSource
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')

  if (!/<NuxtLayout[\s>]/.test(appVueTemplate) || !/<\/NuxtLayout>/.test(appVueTemplate)) {
    violations.push({
      file: 'app/app.vue',
      message: 'R7: app/layouts/ has pages but app.vue does not wrap NuxtPage in NuxtLayout, so every layout is silently ignored',
    })
  }
}

// ── R8 ───────────────────────────────────────────────────────────────────────
/**
 * The top level is a short list, and `docs/aika/README.md` prints it as the map
 * anybody new reads first. A directory that appears without the map changing
 * makes the map wrong, and a wrong map is worse than no map.
 *
 * The README is the source of truth on purpose. A second hardcoded list here
 * would be one more thing to forget, and the failure would look identical.
 *
 * Only directories are checked: files change constantly and are not part of the
 * shape of the repository. Dot directories are skipped because they are tooling
 * (`.git`, `.nuxt`, `.output`), as is `node_modules`.
 */
function documentedTopLevelDirectories(): string[] | null {
  const readmePath = join(root, 'docs', 'aika', 'README.md')
  if (!existsSync(readmePath)) return null

  const lines = readFileSync(readmePath, 'utf8').split('\n')
  const headingIndex = lines.findIndex(line => line.trim() === '## Layout')
  if (headingIndex === -1) return null

  const fenceIndex = lines.findIndex((line, index) => index > headingIndex && line.startsWith('```'))
  if (fenceIndex === -1) return null

  const names: string[] = []

  for (let index = fenceIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (line === undefined || line.startsWith('```')) break

    const match = /^([A-Za-z0-9_.-]+)\//.exec(line)
    if (match?.[1] !== undefined) names.push(match[1])
  }

  return names
}

const IGNORED_TOP_LEVEL = new Set(['node_modules'])
const documentedTopLevel = documentedTopLevelDirectories()

if (documentedTopLevel === null) {
  violations.push({
    file: 'docs/aika/README.md',
    message: 'R8: no `## Layout` map could be read, so the shape of the repository is undocumented',
  })
}
else {
  /*
   * Every directory, including the dot ones, so that a map entry for `.github/`
   * can be verified. The two loops deliberately use different sets. An
   * undocumented dot directory is tooling and not worth naming, but a dot
   * directory the map DOES name has to actually exist, or the map is lying.
   */
  const everyDirectory = readdirSync(root)
    .filter(entry => statSync(join(root, entry)).isDirectory())
    .sort()

  const documentedSet = new Set(documentedTopLevel)

  for (const entry of everyDirectory) {
    if (entry.startsWith('.') || IGNORED_TOP_LEVEL.has(entry)) continue
    if (documentedSet.has(entry)) continue

    violations.push({
      file: `${entry}/`,
      message: 'R8: this top level directory is not in the map in docs/aika/README.md. Add it there with a one line description, or put the code somewhere that already exists',
    })
  }

  for (const entry of documentedSet) {
    if (!everyDirectory.includes(entry)) {
      violations.push({
        file: 'docs/aika/README.md',
        message: `R8: the map lists \`${entry}/\` but no such directory exists`,
      })
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (violations.length === 0) {
  console.log(`arch:check passed: ${features.length} feature(s), no violations.`)
  process.exit(0)
}

console.error(`arch:check failed: ${violations.length} violation(s):\n`)

for (const violation of violations) {
  console.error(`  ${violation.file}`)
  console.error(`    ${violation.message}\n`)
}

process.exit(1)
