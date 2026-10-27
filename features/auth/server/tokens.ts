import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32

/**
 * Session tokens.
 *
 * The browser holds a random token. The database holds only its SHA-256, so a
 * leaked database does not let anyone impersonate a signed-in user.
 *
 * A plain SHA-256 is correct here, unlike for passwords: the token is 32 bytes
 * of cryptographic randomness, so there is no guessable input space to brute
 * force and no need for a slow hash. A slow hash would only make every request
 * slower.
 */
export function mintSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
