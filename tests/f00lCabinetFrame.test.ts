import { describe, expect, it } from 'vitest'
import { referenceCabinetFrame } from '@/lib/referenceCabinetFrame'

describe('landing cabinet frame', () => {
  it('uses the exact reference wardrobe and finished dimensions in the 3D boxes', () => {
    const frame = referenceCabinetFrame()
    expect(frame.dimensions).toEqual({ height: 2000, width: 600, depth: 450 })
    expect(frame.boxes).toHaveLength(11)
    const fronts = frame.boxes.filter((box) => box.role === 'front')
    expect(fronts).toHaveLength(2)
    expect(fronts.every((box) => box.size.x === 295 && box.size.y === 1994)).toBe(true)
    expect(fronts.every((box) => box.position.z < 0)).toBe(true)
  })
})
