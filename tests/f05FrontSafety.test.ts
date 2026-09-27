import { describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import type { CabinetConfig, FrontOpening, Panel } from '../src/core/index'

const catalog = catalogOf(defaultShopProfile())
const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

function cabinet(count: number, opening: FrontOpening = 'auto'): CabinetConfig {
  return {
    ...base,
    sections: base.sections.map((section) => ({
      ...section,
      fronts: { count, mount: 'overlay', opening },
    })),
  }
}

const cups = (panels: Panel[]) => panels.flatMap((panel) => panel.role === 'front'
  ? panel.drilling.filter((drill) => drill.purpose === 'hinge' && drill.diameter === 35) : [])
const plates = (panels: Panel[]) => panels.flatMap((panel) => panel.role !== 'front'
  ? panel.drilling.filter((drill) => drill.purpose === 'hinge' && drill.diameter < 35) : [])

describe('F05 фасад өндірісінің қауіпсіздігі', () => {
  it('екі қарсы жаққа ашылатын есіктің әр чашкасына планка бар', () => {
    const panels = generateCabinet(cabinet(2), catalog)
    expect(plates(panels)).toHaveLength(cups(panels).length * 2)
  })

  it('тірексіз үшінші есікті қабылдамайды', () => {
    expect(() => generateCabinet(cabinet(3), catalog)).toThrow(/fronts\.opening|тірек/)
  })

  it.each(['left', 'right'] as const)('екі есікті түгел %s жаққа ашқанда тірексіз есікті қабылдамайды', (opening) => {
    expect(() => generateCabinet(cabinet(2, opening), catalog)).toThrow(/fronts\.opening|тірек/)
  })

})
