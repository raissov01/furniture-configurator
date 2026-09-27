import { describe, expect, it } from 'vitest'
import { panelOutlinePoints } from '../lib/f32PolygonShape'

describe('F32 polygon shape', () => {
  it('renders the finished polygon outline instead of its blank rectangle', () => {
    const points = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 160 },
      { x: 220, y: 160 }, { x: 220, y: 400 }, { x: 0, y: 400 }]
    expect(panelOutlinePoints({ points }, 600, 400)).toEqual(points)
    expect(panelOutlinePoints(undefined, 600, 400)).toHaveLength(4)
  })
})
