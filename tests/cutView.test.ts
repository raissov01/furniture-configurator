import { describe, expect, it } from 'vitest'
import { cutDisplay, visibleMaterials } from '../lib/cutView'
import type { CutLine } from '../src/core/cutPlan'

const cuts: CutLine[] = [1, 2, 3].map((order) => ({
  order, axis: 'v', at: order, from: 0, to: 10, kind: 'split',
}))

describe('cut view controls', () => {
  it('filters only displayed materials without changing the source', () => {
    const materials = [{ materialId: 'a' }, { materialId: 'b' }]
    expect(visibleMaterials(materials, 'b')).toEqual([{ materialId: 'b' }])
    expect(visibleMaterials(materials, 'all')).toEqual(materials)
    expect(materials).toHaveLength(2)
  })

  it('shows all cuts normally and only reached cuts during playback', () => {
    expect(cutDisplay(cuts, true, false, 0)).toEqual({ visible: cuts, active: null, step: 0, total: 3 })
    expect(cutDisplay(cuts, true, true, 2)).toEqual({ visible: cuts.slice(0, 2), active: cuts[1], step: 2, total: 3 })
    expect(cutDisplay(cuts, false, true, 2)).toEqual({ visible: [], active: null, step: 2, total: 3 })
  })

})
