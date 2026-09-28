import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { shouldCloseRoomDialog } from '../lib/roomDialog'

describe('F12 room modal', () => {
  it('closes only for Escape', () => {
    expect(shouldCloseRoomDialog('Escape')).toBe(true)
    expect(shouldCloseRoomDialog('Enter')).toBe(false)
  })
  it('has dialog semantics, keyboard close and trigger focus restoration', () => {
    const source = readFileSync(new URL('../components/RoomPlan.tsx', import.meta.url), 'utf8')
    expect(source).toContain('role="dialog"')
    expect(source).toContain('aria-modal="true"')
    expect(source).toContain("useModalLayer(open, 'room', () => setOpen(false))")
    expect(source).toContain('trigger?.focus()')
  })
})
