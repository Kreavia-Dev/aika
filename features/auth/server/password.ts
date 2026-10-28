import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * `promisify(scrypt)` loses the overload that accepts options, which means
 * `maxmem` cannot be passed through it. The callback form is wrapped by hand
 * instead, so the parameter that actually matters survives.
 */
function deriveKey(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

/**
 * Password hashing, using scrypt from the Node standard library.
 *
 * WHY NOT argon2id OR bcrypt. Both are reasonable and argon2id is the modern
 * preference. Both are native modules, which means another entry in
 * `allowScripts` and another thing that can fail to build on a fresh clone.
 * scrypt is memory-hard, is listed by OWASP as acceptable, and ships with
 * Node. For this project the tradeoff is worth it.
 *
 * PARAMETERS. OWASP suggests N=2^17 for scrypt. That needs 128 * N * r bytes,
 * so 2^17 costs 128 MB per verification, which is painful on a small VPS under
 * concurrent logins. 2^15 costs 32 MB and is still well above the 2^14 that
 * Node used to default to.
 *
 * The parameters are stored inside each hash. That means they can be raised
 * later without invalidating existing passwords: old hashes keep verifying
 * under the parameters they were created with, and new ones use the new values.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 } as const

/**
 * scrypt needs 128 * N * r bytes plus headroom. Node's default cap is 32 MB,
 * which is exactly at the limit for these parameters, so it is raised here
 * rather than being left to fail intermittently.
 */
const MAX_MEM = 128 * PARAMS.N * PARAMS.r * 2

const ALGORITHM = 'scrypt'
const SALT_BYTES = 16
const FIELD_SEPARATOR = '$'

/**
 * Bounds on the parameters read back out of a stored hash.
 *
 * `parseEncodedHash` parses a string that comes from the database, and the
 * parameters in it decide how much memory and CPU the verification will spend.
 * Today the only writer of that string is `hashPassword` above, so nothing can
 * plant a hostile one. That stops being true the moment a seed script, an
 * import, or a restored backup writes a hash from somewhere else, and a
 * `malloc failure` escaping as a 500 would be a poor way to find out.
 *
 * `MIN_N` is not lower than 2^14 because scrypt rejects some small values
 * outright, `N=2` among them, and a rejected parameter used to throw out of
 * `verifyPassword` as a 500 instead of returning a failed sign in.
 */
const MIN_N = 2 ** 14
const MAX_N = 2 ** 20
const MAX_R = 16
const MAX_P = 4

/**
 * A hash shorter than this is not a real scrypt output.
 *
 * `keylen` is taken from the stored hash's length, so a truncated hash would
 * shorten the comparison as well. A one byte hash would accept roughly one in
 * 256 wrong passwords. This floor closes that.
 */
const MIN_HASH_BYTES = 32

/**
 * How much entropy the generated passwords carry.
 *
 * 18 bytes is 144 bits, rendered as 24 URL safe characters. Far beyond what brute
 * force reaches, and short enough that somebody will actually copy it from a
 * terminal instead of deciding it is a nuisance and making up their own.
 */
const GENERATED_PASSWORD_BYTES = 18

/**
 * A password strong enough that nobody has to judge it.
 *
 * WHY THIS LIVES HERE AND NOT IN A SCRIPT. `user:create` and `user:password` both
 * generate one, and a second copy would be a second strength decision that only
 * one of them gets fixed later.
 *
 * Base64url, so it survives being pasted into a shell, a `.env` file, or a chat
 * message without quoting. It contains no `$`, which is the character that breaks
 * a double quoted shell string, and no character that needs escaping in JSON.
 */
export function generatePassword(): string {
  return randomBytes(GENERATED_PASSWORD_BYTES).toString('base64url')
}

export async function hashPassword(password: string): Promise<string> {  const salt = randomBytes(SALT_BYTES)
  const derived = await deriveKey(password, salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: MAX_MEM,
  })

  return [
    ALGORITHM,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join(FIELD_SEPARATOR)
}

/**
 * Verifies a password against an encoded hash.
 *
 * Returns false for a malformed hash rather than throwing, so a corrupted row
 * is a failed login instead of a 500 that reveals the row is corrupted.
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parsed = parseEncodedHash(encoded)
  if (!parsed) return false

  let derived: Buffer

  try {
    derived = await deriveKey(password, parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: 128 * parsed.N * parsed.r * 2,
    })
  }
  catch {
    // A hash whose parameters cannot actually be run is a failed sign in, not a
    // 500 that reports the row is malformed.
    return false
  }

  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash)
}

type ParsedHash = {
  N: number
  r: number
  p: number
  salt: Buffer
  hash: Buffer
}

function parseEncodedHash(encoded: string): ParsedHash | null {
  const parts = encoded.split(FIELD_SEPARATOR)
  if (parts.length !== 6) return null

  const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = parts
  if (algorithm !== ALGORITHM) return null

  const N = Number(rawN)
  const r = Number(rawR)
  const p = Number(rawP)

  if (!Number.isInteger(N) || N < MIN_N || N > MAX_N || (N & (N - 1)) !== 0) return null
  if (!Number.isInteger(r) || r < 1 || r > MAX_R) return null
  if (!Number.isInteger(p) || p < 1 || p > MAX_P) return null

  const salt = Buffer.from(rawSalt ?? '', 'base64url')
  const hash = Buffer.from(rawHash ?? '', 'base64url')

  if (salt.length === 0 || hash.length < MIN_HASH_BYTES) return null

  return { N, r, p, salt, hash }
}

let dummyHash: string | null = null

/**
 * Spends the same time as a real verification, against a hash nothing matches.
 *
 * Call this when the email is unknown. Without it, a missing account answers
 * in microseconds while a real one spends tens of milliseconds in scrypt, and
 * that difference tells an attacker which emails are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= await hashPassword('a-password-that-is-never-valid')
  await verifyPassword(password, dummyHash)
}
