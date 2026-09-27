import { describe, expect, it } from 'vitest'
import { showLegacyDrawerProfileWarning } from '../lib/legacyDrawerProfile'

describe('legacy drawer profile notice', () => {
  it('appears only when a drawer uses the old mixed profile', () => {
    expect(showLegacyDrawerProfileWarning(undefined, true)).toBe(true)
    expect(showLegacyDrawerProfileWarning('roller', true)).toBe(false)
    expect(showLegacyDrawerProfileWarning(undefined, false)).toBe(false)
  })
})
