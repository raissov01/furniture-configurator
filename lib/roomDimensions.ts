import type { Room } from '@/src/core/types'

/** Bounds shown by the room form; validate the same bounds at the store boundary. */
export const ROOM_DIMENSIONS = {
  width: { min: 500, max: 20000 },
  depth: { min: 500, max: 20000 },
  height: { min: 2000, max: 4000 },
} as const

type RoomDimension = keyof typeof ROOM_DIMENSIONS
export type RoomDimensionIssue = { field: `room.${RoomDimension}`; allowed: string }

export function roomDimensionIssue(patch: Partial<Room>): RoomDimensionIssue | null {
  for (const key of ['width', 'depth', 'height'] as const) {
    const value = patch[key]
    if (value === undefined) continue
    const { min, max } = ROOM_DIMENSIONS[key]
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      return { field: `room.${key}`, allowed: `${min}..${max} мм` }
    }
  }
  return null
}
