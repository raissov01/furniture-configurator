import { describe, expect, it } from 'vitest'
import { tourCardPosition } from '../lib/f32TourPosition'

describe('F32 UI decisions', () => {
  it('keeps the tour card and its actions inside a 390 × 844 viewport', () => {
    const position = tourCardPosition({ top: 800, bottom: 840, left: 360 }, 390, 844, 220, 320)
    expect(position.top).toBeGreaterThanOrEqual(12)
    expect(position.top + 220).toBeLessThanOrEqual(832)
    expect(position.left).toBeGreaterThanOrEqual(12)
    expect(position.left + 320).toBeLessThanOrEqual(378)
  })
})
