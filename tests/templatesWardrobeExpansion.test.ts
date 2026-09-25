import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, defaultShopProfile, formatCutList, generateCabinet, generateHardware, nestPanels, priceProject, templateToCabinet } from '../src/core/index'
import { WARDROBE_EXPANSION_TEMPLATES } from '../src/core/templatesWardrobeExpansion'

describe('шкаф пен кіреберіс шаблондары', () => {
  it('әр шаблон бірегей және нақты панель мен жарамды кесу өлшемін береді', () => {
    const ids = WARDROBE_EXPANSION_TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(5)
    for (const template of WARDROBE_EXPANSION_TEMPLATES) {
      const config = templateToCabinet(template, SEED_CATALOG)
      const panels = generateCabinet(config, SEED_CATALOG)
      expect(panels.length, template.id).toBeGreaterThan(0)
      expect(panels.every((panel) => panel.cutLength > 0 && panel.cutWidth > 0), template.id).toBe(true)
      expect(formatCutList(panels, SEED_CATALOG).reduce((sum, row) => sum + row.qty, 0), template.id)
        .toBe(panels.reduce((sum, panel) => sum + panel.qty, 0))
      expect(config.height).toBeGreaterThanOrEqual(template.range.height.min)
      expect(config.width).toBeLessThanOrEqual(template.range.width.max)
    }
  })

  it('4 есікті купе: 4 салма және 4 ролик жиынтығы', () => {
    const template = WARDROBE_EXPANSION_TEMPLATES.find((item) => item.id === 'wardrobe-sliding-4-2400')!
    const config = templateToCabinet(template, SEED_CATALOG)
    expect(config.sliding?.count).toBe(4)
    expect(config.sections).toHaveLength(4)
    const panels = generateCabinet(config, SEED_CATALOG)
    expect(panels.filter((panel) => panel.label === 'Вставка двери-купе')).toHaveLength(4)
    expect(generateHardware(config, SEED_CATALOG).find((item) => item.kind === 'slidingDoorKit')?.qty).toBe(4)
  })

  it('4 ілмелі есікті шкаф PRO100 өлшемімен және ілмек фурнитурасымен келеді', () => {
    const template = WARDROBE_EXPANSION_TEMPLATES.find((item) => item.id === 'wardrobe-hinged-4-1864')!
    const config = templateToCabinet(template, SEED_CATALOG)
    expect([config.height, config.width, config.depth]).toEqual([2096, 1864, 618])
    expect(config.sliding).toBeUndefined()
    expect(config.sections).toHaveLength(4)
    const panels = generateCabinet(config, SEED_CATALOG)
    expect(panels.filter((panel) => panel.role === 'front')).toHaveLength(4)
    expect(panels.filter((panel) => panel.role === 'front').every((panel) =>
      panel.drilling.some((drill) => drill.purpose === 'hinge' && drill.diameter === 35))).toBe(true)
  })

  it('тар антресоль толық корпус, бір ілмелі есік, штангасыз', () => {
    const template = WARDROBE_EXPANSION_TEMPLATES.find((item) => item.id === 'wardrobe-antresol-300')!
    const config = templateToCabinet(template, SEED_CATALOG)
    expect(config.width).toBe(300)
    const panels = generateCabinet(config, SEED_CATALOG)
    expect(panels.filter((panel) => panel.role === 'front')).toHaveLength(1)
    expect(generateHardware(config, SEED_CATALOG).some((item) => item.kind === 'rod')).toBe(false)
  })

  it('пантограф сатып алынатын фурнитура, панель емес', () => {
    const template = WARDROBE_EXPANSION_TEMPLATES.find((item) => item.id === 'wardrobe-pantograph-1000')!
    const config = templateToCabinet(template, SEED_CATALOG)
    expect(config.sections[0]?.contents.some((content) =>
      content.kind === 'filling' && content.filling === 'pantograph')).toBe(true)
    expect(generateHardware(config, SEED_CATALOG).find((item) => item.hardwareId === 'filling-pantograph')?.qty).toBe(1)
    const panels = generateCabinet(config, SEED_CATALOG)
    expect(panels.some((panel) => panel.label === 'Пантограф')).toBe(false)
    const quote = priceProject(panels, nestPanels(panels, SEED_CATALOG), defaultShopProfile(),
      generateHardware(config, SEED_CATALOG))
    expect(quote.hardware.find((line) => line.id === 'filling-pantograph')?.qty).toBe(1)
  })

  it('ашық кіреберіс модулі штанга мен аяқкиім сөрелерін бөлек секцияға қояды', () => {
    const template = WARDROBE_EXPANSION_TEMPLATES.find((item) => item.id === 'hallway-open-1000')!
    const config = templateToCabinet(template, SEED_CATALOG)
    expect(config.sections).toHaveLength(2)
    expect(config.sections.every((section) => section.fronts === null)).toBe(true)
    expect(generateHardware(config, SEED_CATALOG).filter((item) => item.kind === 'rod')).toHaveLength(1)
    expect(generateCabinet(config, SEED_CATALOG).some((panel) => panel.role === 'shelf')).toBe(true)
  })
})
