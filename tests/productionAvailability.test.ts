import { describe, expect, it } from 'vitest'
import { productionAvailability } from '../lib/productionAvailability'

describe('production availability in the workspace', () => {
  it('hides the cut list and blocks exports for invalid persisted input', () => {
    expect(productionAvailability('sections[0].contents[0].count: 21', false)).toEqual({ cutListAvailable: false, exportsAvailable: false })
  })
  it('also blocks manufacturing while an invalid draft remains only in a field', () => {
    expect(productionAvailability(null, true)).toEqual({ cutListAvailable: false, exportsAvailable: false })
  })
  it('restores both views for valid input', () => {
    expect(productionAvailability(null, false)).toEqual({ cutListAvailable: true, exportsAvailable: true })
  })
})
