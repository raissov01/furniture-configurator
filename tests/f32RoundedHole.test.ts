import { describe, expect, it } from 'vitest'
import { roundedHolePath, roundedHoleSegments } from '../lib/f32RoundedHole'

describe('F32 rounded hole', () => {
  it('uses four arcs for a rounded cutout', () => {
    expect(roundedHoleSegments({ x: 100, y: 100, width: 204, height: 60 }, 5).arcs)
      .toHaveLength(4)
    const points = roundedHolePath({ x: 100, y: 100, width: 204, height: 60 }, 5).getPoints()
    expect(points.some((point) => point.x === 100 && point.y === 100)).toBe(false)
    expect(points.some((point) => point.x === 105 && point.y === 100)).toBe(true)
  })
})
