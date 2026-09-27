import { describe, expect, it } from 'vitest'
import { roomDimensionIssue } from '../lib/roomDimensions'

describe('F12 room dimensions', () => {
  it('rejects invalid dimensions before changing saved state', () => {
    expect(roomDimensionIssue({ width: 0 })).toMatchObject({ field: 'room.width', allowed: '500..20000 мм' })
    expect(roomDimensionIssue({ width: 499 })).toMatchObject({ field: 'room.width' })
    expect(roomDimensionIssue({ width: 20001 })).toMatchObject({ field: 'room.width' })
    expect(roomDimensionIssue({ width: 500.5 })).toMatchObject({ field: 'room.width' })
    expect(roomDimensionIssue({ height: 1999 })).toMatchObject({ field: 'room.height', allowed: '2000..4000 мм' })
    expect(roomDimensionIssue({ width: 500, depth: 20000, height: 4000 })).toBeNull()
  })
})
