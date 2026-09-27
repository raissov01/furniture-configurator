import { describe, expect, it } from 'vitest'
import { drawerFillerStep } from '../lib/drawerFillerStep'

describe('drawer filler step', () => {
  it('uses the thickness of the selected carcass material', () => {
    const materials = [{ id: 'carcass-16', thickness: 16 }, { id: 'carcass-18', thickness: 18 }]
    expect(drawerFillerStep(materials, 'carcass-18')).toBe(18)
    expect(drawerFillerStep(materials, 'carcass-16')).toBe(16)
    expect(drawerFillerStep(materials, 'missing')).toBeNull()
  })
})
