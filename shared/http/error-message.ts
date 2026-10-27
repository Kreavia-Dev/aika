/**
 * Turns a thrown fetch error into something worth showing a visitor.
 *
 * Browser safe, and deliberately import free: it costs the client bundle almost
 * nothing and cannot accidentally drag the Hono app into the browser. The sign
 * in form and the contact form need exactly this, and a second copy of it is a
 * second place to get the narrowing wrong.
 *
 * The API's failure envelope is `{ success, message, code, errors? }`, and the
 * useful part is `message`. Reaching it means narrowing `unknown` twice, because
 * `catch (error)` hands you `unknown`, and casting to `any` to get past that is
 * the habit that makes a codebase unsafe later.
 */
export function messageFromApiError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data: unknown }).data
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (data as { message: unknown }).message
      if (typeof message === 'string' && message.length > 0) return message
    }
  }

  return fallback
}
