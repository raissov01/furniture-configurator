import { describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import type { CabinetConfig, Catalog, HingeSystem } from '../src/core/index'

const catalog = catalogOf(defaultShopProfile())
const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

function inset(hingeSystemId?: string): CabinetConfig {
  return {
    ...base,
    sections: base.sections.map((section) => ({
      ...section,
      contents: [],
      fronts: { count: 1, mount: 'inset', ...(hingeSystemId ? { hingeSystemId } : {}) },
    })),
  }
}

describe('F05 петля түрі', () => {
  it('таңдалған overlay петляны inset есікке жібермейді', () => {
    expect(() => generateCabinet(inset('hinge-blum-soft-cross-overlay'), catalog))
      .toThrow(/fronts\.hingeSystemId.*inset|fronts\.hingeSystemId.*вкладн/)
  })

  it('артикул таңдалмаса, каталогтағы сәйкес inset петляны қолданады', () => {
    const panels = generateCabinet(inset(), catalog)
    expect(panels.filter((panel) => panel.role === 'front')).toHaveLength(1)
    expect(panels.some((panel) => panel.role !== 'front'
      && panel.drilling.some((drill) => drill.purpose === 'hinge'))).toBe(true)
  })

  it('цех енгізген inset петлямен фасад пен планка тесіктері жасалады', () => {
    const shopSystem = { ...catalog.hingeSystems![0]!, id: 'shop-inset', mount: 'inset' } as HingeSystem
    const shopCatalog: Catalog = { ...catalog, hingeSystems: [...catalog.hingeSystems!, shopSystem] }
    const panels = generateCabinet(inset('shop-inset'), shopCatalog)
    expect(panels.filter((panel) => panel.role === 'front')).toHaveLength(1)
    expect(panels.some((panel) => panel.role !== 'front'
      && panel.drilling.some((drill) => drill.purpose === 'hinge'))).toBe(true)
  })
})
