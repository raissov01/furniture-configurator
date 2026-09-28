import { describe, expect, it } from 'vitest'
import { planDragOffset } from '../lib/roomPlanDrag'
import { readFileSync } from 'node:fs'

describe('F12 responsive plan drag', () => {
  it('uses the displayed scale for pointer movement', () => {
    expect(planDragOffset(100, 40, 0.1, 1000)).toBe(500)
    expect(planDragOffset(100, 200, 0.1, 1000)).toBe(1000)
  })
  it('lets the plan and dimension fields fit a narrow dialog', () => {
    const source = readFileSync(new URL('../components/RoomPlan.tsx', import.meta.url), 'utf8')
    expect(source).toContain('max-w-[420px] min-w-0')
    expect(source).toContain('lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]')
    expect(source).toContain('grid grid-cols-1 gap-2 min-[460px]:grid-cols-3')
    expect(source).not.toContain('shrink-0 rounded-lg')
  })
})
