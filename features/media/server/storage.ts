import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Where uploaded files go.
 *
 * WHY THIS IS AN INTERFACE RATHER THAN A DIRECTORY. Every client site starts on
 * one machine's local disk, and the first client with real traffic eventually
 * wants object storage instead. If the calls to `node:fs` are spread through the
 * service and the routes, that migration is a rewrite. Here it is one new file
 * that implements the same three methods.
 *
 * The interface is deliberately this small. `put`, `read` and `remove` are what
 * the feature actually does today. Adding `list` or `url` before something needs
 * them would be guessing at the shape of an adapter that does not exist yet.
 */
export type MediaStorage = {
  put(key: string, bytes: Uint8Array): void
  /** Bytes, or null when there is nothing under that key. */
  read(key: string): Uint8Array | null
  remove(key: string): void
}

/**
 * The only filenames this adapter will touch.
 *
 * The feature already generates its keys from a UUID, so in a correct program
 * this pattern never rejects anything. It is here because the alternative is an
 * adapter whose safety depends on every caller being correct forever, and an
 * upload path is exactly where somebody later decides to honour a client's
 * original filename.
 *
 * It also rejects `..`, a leading slash, and a backslash by construction, since
 * none of those characters appear in the pattern.
 */
const SAFE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key)) {
    throw new Error(`Refusing to touch a media key that is not the shape this feature generates: ${key}`)
  }
}

/**
 * A storage adapter backed by a directory on this machine.
 *
 * The root is resolved once, at construction, so a caller cannot change the
 * meaning of an existing adapter by changing the working directory later.
 */
export function createLocalMediaStorage(root: string): MediaStorage {
  const absoluteRoot = resolve(root)

  function pathFor(key: string): string {
    assertSafeKey(key)
    return join(absoluteRoot, key)
  }

  return {
    put(key, bytes) {
      const target = pathFor(key)
      // The root may not exist on a machine that has never uploaded anything.
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, bytes)
    },

    read(key) {
      const target = pathFor(key)
      if (!existsSync(target)) return null
      return readFileSync(target)
    },

    remove(key) {
      const target = pathFor(key)
      // Idempotent: removing something that is already gone is not an error, so
      // a retry after a partial failure does not need its own special case.
      rmSync(target, { force: true })
    },
  }
}
