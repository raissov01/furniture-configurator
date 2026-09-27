import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOM, defaultOpenings, validateOpenings } from '../src/core/index'
import { nextOpening, updateOpening } from '../lib/roomOpeningsUi'

describe('F12 room openings', () => {
  it('keeps out-of-room openings available for exact repair', () => {
    const initial = defaultOpenings(DEFAULT_ROOM)
    const smallRoom = { ...DEFAULT_ROOM, width: 2000, openings: initial }
    expect(validateOpenings(smallRoom).length).toBeGreaterThan(0)
    const door = initial.find((opening) => opening.kind === 'door')!
    const repaired = updateOpening(initial, door.id, { offset: 1200 })
    expect(repaired.find((opening) => opening.id === door.id)?.offset).toBe(1200)
    expect(initial.find((opening) => opening.id === door.id)?.offset).toBe(2900)
  })

  it('gives a newly added opening a unique stable id', () => {
    const openings = defaultOpenings(DEFAULT_ROOM)
    const added = nextOpening(DEFAULT_ROOM, openings, 'window')
    expect(openings.some((opening) => opening.id === added.id)).toBe(false)
    expect(nextOpening(DEFAULT_ROOM, [...openings, added], 'window').id).not.toBe(added.id)
  })
})
