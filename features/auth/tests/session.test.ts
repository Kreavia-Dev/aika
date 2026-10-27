import { describe, expect, it } from 'vitest'
import { sessionHasExpired } from '../server/service'

/**
 * The expiry check is a pure function so it can be tested without a database.
 *
 * It exists as its own function because of a real defect: comparing the stored
 * string directly against `new Date().toISOString()` meant a value like `zzzz`
 * sorted above the current timestamp and authenticated forever. A date that
 * cannot be parsed must never mean "still valid".
 */
const NOW = Date.parse('2026-10-27T12:00:00.000Z')

describe('sessionHasExpired', () => {
  it('accepts a future timestamp', () => {
    expect(sessionHasExpired('2026-11-27T12:00:00.000Z', NOW)).toBe(false)
  })

  it('rejects a past timestamp', () => {
    expect(sessionHasExpired('2026-09-27T12:00:00.000Z', NOW)).toBe(true)
  })

  it('rejects the exact boundary moment', () => {
    expect(sessionHasExpired('2026-10-27T12:00:00.000Z', NOW)).toBe(true)
  })

  it('fails closed on anything it cannot parse', () => {
    const unparseable = ['zzzz', '', 'not a date', '9999-99-99T99:99:99Z', '0']

    for (const value of unparseable) {
      expect(sessionHasExpired(value, NOW)).toBe(true)
    }
  })

  it('does not treat a lexicographically large string as a future date', () => {
    // This exact case produced an authenticated session before the fix.
    expect(sessionHasExpired('zzzz', NOW)).toBe(true)
  })

  it('fails closed on a numeric expiry, which is not the stored format', () => {
    // The stored format is an ISO 8601 string. A number is a format regression,
    // and a regression must lock people out rather than let everyone in. This is
    // the exact shape that authenticated a session before the fix.
    expect(sessionHasExpired(String(NOW + 60_000), NOW)).toBe(true)
  })
})
