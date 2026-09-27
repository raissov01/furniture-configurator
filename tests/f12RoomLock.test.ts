import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('F12 locked cabinet room controls', () => {
  it('keeps room dimensions and finish available independently of cabinet locks', () => {
    const roomPlan = readFileSync(new URL('../components/RoomPlan.tsx', import.meta.url), 'utf8')
    expect(roomPlan).not.toContain('roomEditable')
    expect(roomPlan).not.toContain('disabled={!roomEditable}')
    expect(roomPlan).toContain('disabled={!movableIds.has(active.id)}')
  })
})
