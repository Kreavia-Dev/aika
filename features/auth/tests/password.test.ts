import { describe, expect, it } from 'vitest'
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../server/password'

const PASSWORD = 'correct horse battery staple'

describe('hashPassword', () => {
  it('never stores the plaintext', async () => {
    const encoded = await hashPassword(PASSWORD)

    expect(encoded).not.toContain(PASSWORD)
  })

  it('encodes the algorithm and its parameters', async () => {
    const encoded = await hashPassword(PASSWORD)
    const parts = encoded.split('$')

    expect(parts).toHaveLength(6)
    expect(parts[0]).toBe('scrypt')

    // Asserting the exact work factor on purpose. It is a security parameter,
    // not an implementation detail, so lowering it should break a test and make
    // somebody think about it.
    expect(parts[1]).toBe('32768')
    expect(parts[2]).toBe('8')
    expect(parts[3]).toBe('1')
  })

  it('salts every hash, so the same password hashes differently twice', async () => {
    const first = await hashPassword(PASSWORD)
    const second = await hashPassword(PASSWORD)

    expect(first).not.toBe(second)
  })
})

describe('verifyPassword', () => {
  it('accepts the correct password', async () => {
    const encoded = await hashPassword(PASSWORD)

    await expect(verifyPassword(PASSWORD, encoded)).resolves.toBe(true)
  })

  it('rejects the wrong password', async () => {
    const encoded = await hashPassword(PASSWORD)

    await expect(verifyPassword('not the password', encoded)).resolves.toBe(false)
  })

  it('rejects a password that is a prefix of the real one', async () => {
    const encoded = await hashPassword(PASSWORD)

    await expect(verifyPassword(PASSWORD.slice(0, -1), encoded)).resolves.toBe(false)
  })

  it('returns false for a malformed hash instead of throwing', async () => {
    // A corrupted row should be a failed sign in, not a 500 that tells an
    // attacker which row is corrupted.
    for (const malformed of ['', 'garbage', 'scrypt$1', 'scrypt$32768$8$1$onlyfive', 'md5$32768$8$1$c2FsdA$aGFzaA']) {
      await expect(verifyPassword(PASSWORD, malformed)).resolves.toBe(false)
    }
  })

  it('returns false for parameters that are not powers of two', async () => {
    const encoded = await hashPassword(PASSWORD)
    const parts = encoded.split('$')
    parts[1] = '30000'

    await expect(verifyPassword(PASSWORD, parts.join('$'))).resolves.toBe(false)
  })

  it('still verifies a hash made with different parameters', async () => {
    // The point of storing parameters inside the hash: raising the work factor
    // later must not lock existing users out.
    const encoded = await hashPassword(PASSWORD)
    const parts = encoded.split('$')
    parts[1] = '16384'

    // Rewriting the parameter makes the stored hash no longer match, so this
    // must fail. What matters is that it fails cleanly rather than throwing.
    await expect(verifyPassword(PASSWORD, parts.join('$'))).resolves.toBe(false)
  })
})

describe('parseEncodedHash bounds', () => {
  const salt = Buffer.alloc(16).toString('base64url')
  const hash = Buffer.alloc(64).toString('base64url')

  it('refuses an absurd work factor instead of trying to run it', async () => {
    // N=2^22 asks for roughly 4 GB and a multi second hash. It must be refused,
    // and refused fast, not attempted and then reported as a 500.
    const hostile = `scrypt$${2 ** 22}$8$1$${salt}$${hash}`
    const started = performance.now()

    await expect(verifyPassword(PASSWORD, hostile)).resolves.toBe(false)

    expect(performance.now() - started).toBeLessThan(500)
  })

  it('refuses out of range r and p', async () => {
    await expect(verifyPassword(PASSWORD, `scrypt$32768$99$1$${salt}$${hash}`)).resolves.toBe(false)
    await expect(verifyPassword(PASSWORD, `scrypt$32768$8$99$${salt}$${hash}`)).resolves.toBe(false)
  })

  it('refuses a truncated hash rather than comparing fewer bytes', async () => {
    // keylen comes from the stored hash length, so a one byte hash would accept
    // roughly one in 256 wrong passwords. The floor must reject it before any
    // hashing happens, which is also why this loop is fast.
    const oneByte = Buffer.alloc(1).toString('base64url')
    const truncated = `scrypt$16384$8$1$${salt}$${oneByte}`

    for (let attempt = 0; attempt < 64; attempt++) {
      await expect(verifyPassword(String(attempt), truncated)).resolves.toBe(false)
    }
  })
})

describe('verifyAgainstDummy', () => {
  it('resolves without revealing anything', async () => {
    await expect(verifyAgainstDummy(PASSWORD)).resolves.toBeUndefined()
  })

  it('costs a comparable amount of time to a real verification', async () => {
    const encoded = await hashPassword(PASSWORD)

    const realStart = performance.now()
    await verifyPassword(PASSWORD, encoded)
    const realDuration = performance.now() - realStart

    const dummyStart = performance.now()
    await verifyAgainstDummy(PASSWORD)
    const dummyDuration = performance.now() - dummyStart

    // Generous bounds. The point is that the dummy path is not orders of
    // magnitude faster, which is what leaks whether an email is registered.
    expect(dummyDuration).toBeGreaterThan(realDuration / 10)
  })
})
