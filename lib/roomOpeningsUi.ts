import { defaultOpenings } from '@/src/core/room'
import type { Room, RoomOpening } from '@/src/core/types'

export function updateOpening(openings: RoomOpening[], id: string, patch: Partial<RoomOpening>): RoomOpening[] {
  return openings.map((opening) => opening.id === id ? { ...opening, ...patch } : opening)
}

export function nextOpening(room: Room, openings: RoomOpening[], kind: RoomOpening['kind']): RoomOpening {
  const template = defaultOpenings(room).find((opening) => opening.kind === kind)
  const ids = new Set(openings.map((opening) => opening.id))
  let index = 1
  while (ids.has(`${kind}-${index}`)) index += 1
  return {
    id: `${kind}-${index}`,
    kind,
    wall: template?.wall ?? 'south',
    offset: template?.offset ?? 0,
    width: template?.width ?? Math.min(800, room.width),
    height: template?.height ?? Math.min(1200, room.height),
    elevation: template?.elevation ?? 0,
  }
}
