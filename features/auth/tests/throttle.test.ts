import { describe, expect, it } from 'vitest'
import { ServiceUnavailableError } from '../../../shared/errors'
import {
  MAX_CONCURRENT_PASSWORD_VERIFICATIONS,
  passwordWorkInFlight,
  withPasswordWork,
} from '../server/throttle'

/**
 * The load shed, tested deterministically.
 *
 * These use manually resolved promises rather than timing, so they cannot go
 * flaky on a slow machine. Asserting concurrency with a sleep is how a suite
 * starts failing once a week.
 */
describe('withPasswordWork', () => {
  it('runs work and returns its result', async () => {
    await expect(withPasswordWork(async () => 'done')).resolves.toBe('done')
  })

  it('refuses work once the ceiling is reached', async () => {
    const release: Array<() => void> = []

    const held = Array.from(
      { length: MAX_CONCURRENT_PASSWORD_VERIFICATIONS },
      () => withPasswordWork(() => new Promise<void>((resolve) => {
        release.push(resolve)
      })),
    )

    expect(passwordWorkInFlight()).toBe(MAX_CONCURRENT_PASSWORD_VERIFICATIONS)

    await expect(withPasswordWork(async () => 'one too many'))
      .rejects
      .toBeInstanceOf(ServiceUnavailableError)

    for (const resolve of release) resolve()
    await Promise.all(held)

    expect(passwordWorkInFlight()).toBe(0)
  })

  it('accepts work again once the queue drains', async () => {
    await expect(withPasswordWork(async () => 'ok')).resolves.toBe('ok')
  })

  it('releases the slot when the work throws', async () => {
    await expect(withPasswordWork(async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')

    // A leaked slot would slowly strangle sign in, which is a worse bug than the
    // one it was hiding.
    expect(passwordWorkInFlight()).toBe(0)
    await expect(withPasswordWork(async () => 'still fine')).resolves.toBe('still fine')
  })
})
