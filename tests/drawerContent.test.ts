import { describe, expect, it } from 'vitest'
import { drawerContentWithCount } from '../lib/drawerContent'

describe('section drawer count', () => {
  it('preserves the configured drawer properties when the count changes', () => {
    const current = { kind: 'drawers' as const, count: 3, height: 225,
      gaps: { left: 5 }, fillers: { left: 18 }, frontMount: 'inset' as const }
    expect(drawerContentWithCount(current, 2)).toEqual({ ...current, count: 2 })
    expect(drawerContentWithCount(current, 0)).toBeNull()
    expect(drawerContentWithCount(undefined, 1)).toEqual({ kind: 'drawers', count: 1 })
  })
})
