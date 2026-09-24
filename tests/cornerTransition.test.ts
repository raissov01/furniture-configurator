import { describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import { enableCornerCabinet } from '../lib/cornerTransition'

const catalog = catalogOf(defaultShopProfile())

describe('corner editor transition', () => {
  it('turns a split fixed-width wardrobe into one open flex section that the panel engine accepts', () => {
    const original = templateToCabinet(findTemplate('wardrobe-rod-1000')!, catalog)
    const first = { ...original.sections[0]!, widthMode: 'fixed' as const, width: 479 }
    const thickness = catalog.materials.find((material) => material.id === original.carcassMaterialId)!.thickness
    const split = {
      ...original,
      sections: [first, { ...first, id: 's2', width: original.width - 3 * thickness - first.width }],
    }
    expect(generateCabinet(split, catalog).length).toBeGreaterThan(0)
    expect(() => generateCabinet({ ...split, corner: { depthAtRight: 300 }, back: { mode: 'none' },
      sections: [{ ...first, fronts: null }] }, catalog)).toThrow(/fixed секциялар/)

    const converted = { ...split, ...enableCornerCabinet(split) }
    expect(generateCabinet(converted, catalog).length).toBeGreaterThan(0)
    expect(converted.sections).toEqual([{
      ...first, widthMode: 'flex', width: undefined, fronts: null,
    }])
    expect(converted.back).toEqual({ mode: 'none' })
    expect(converted.corner).toEqual({ depthAtRight: 300 })
  })
})
