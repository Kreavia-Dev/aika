import { ServiceUnavailableError } from '../../../shared/errors'

/**
 * A ceiling on how many password verifications run at once.
 *
 * WHY. scrypt costs roughly 70 ms of CPU per verification, and Aika is one Node
 * process on one thread. Sign in is the only endpoint in Aika that does
 * deliberate slow work, which makes it the only endpoint where an unauthenticated
 * burst can keep that one thread busy while every other request on the site,
 * including the health endpoint, queues behind it. That is measured, not
 * theoretical.
 *
 * WHAT THIS IS. A load shed. It refuses work the process cannot afford. It does
 * not ban anyone and it remembers nothing, so a burst passes and the next
 * request is served normally.
 *
 * WHAT THIS IS NOT. Brute force protection. An attacker staying under this
 * ceiling still gets tens of attempts per second, and this cannot stop that. It
 * also lives in one process, so it resets on restart and would not apply across
 * instances if Aika ever ran more than one.
 *
 * Limiting sign in properly belongs at the reverse proxy, which can do it per
 * address and before the request reaches Node. It stays on the roadmap for
 * Phase 3, and `docs/aika/SECURITY.md` says so out loud.
 */
export const MAX_CONCURRENT_PASSWORD_VERIFICATIONS = 4

let inFlight = 0

/** Observable so a test can assert the slot is released on every path. */
export function passwordWorkInFlight(): number {
  return inFlight
}

/**
 * Runs password work, or refuses it when the process is already at capacity.
 *
 * The slot is released in `finally`, so a verification that throws cannot leak a
 * slot and slowly strangle sign in.
 */
export async function withPasswordWork<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_PASSWORD_VERIFICATIONS) {
    throw new ServiceUnavailableError(
      'Too many sign in attempts right now. Please try again in a moment.',
    )
  }

  inFlight++

  try {
    return await work()
  }
  finally {
    inFlight--
  }
}
