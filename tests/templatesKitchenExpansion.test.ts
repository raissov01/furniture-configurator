import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, formatCutList, generateCabinet, templateToCabinet } from '../src/core/index'
import { KITCHEN_EXPANSION_TEMPLATES } from '../src/core/templatesKitchenExpansion'

describe('ас үй каталогының расталған кеңейтілуі', () => {
  it('әр жаңа seed нақты деталировка мен присадка береді', () => {
    for (const template of KITCHEN_EXPANSION_TEMPLATES) {
      const cabinet = templateToCabinet(template, SEED_CATALOG)
      const panels = generateCabinet(cabinet, SEED_CATALOG)
      expect(formatCutList(panels, SEED_CATALOG).length, template.id).toBeGreaterThan(0)
      expect(panels.some((panel) => panel.drilling.length > 0), template.id).toBe(true)
      expect(template.category).toBe('kitchen')
    }
  })

  it('екі және төрт тартпалы тумбаның әр тартпасы жеке физикалық қорап береді', () => {
    for (const count of [2, 4]) {
      const template = KITCHEN_EXPANSION_TEMPLATES.find((item) => item.id === `kitchen-base-drawers-${count}-600`)
      expect(template).toBeDefined()
      const panels = generateCabinet(templateToCabinet(template!, SEED_CATALOG), SEED_CATALOG)
      expect(panels.filter((panel) => panel.role === 'drawerBottom')).toHaveLength(count)
      expect(panels.filter((panel) => panel.role === 'drawerSide')).toHaveLength(2 * count)
      expect(panels.flatMap((panel) => panel.drilling).some((hole) => hole.purpose === 'runner')).toBe(true)
    }
  })

  it('ашық модульде фасад жоқ, биік модульде ішкі сөрелер бар', () => {
    const open = KITCHEN_EXPANSION_TEMPLATES.find((item) => item.id === 'kitchen-base-open-600')!
    const tall = KITCHEN_EXPANSION_TEMPLATES.find((item) => item.id === 'kitchen-tall-pantry-2180')!
    const openPanels = generateCabinet(templateToCabinet(open, SEED_CATALOG), SEED_CATALOG)
    const tallPanels = generateCabinet(templateToCabinet(tall, SEED_CATALOG), SEED_CATALOG)
    expect(openPanels.some((panel) => panel.role === 'front')).toBe(false)
    expect(openPanels.some((panel) => panel.role === 'shelf')).toBe(true)
    expect(tallPanels.filter((panel) => panel.role === 'shelf')).toHaveLength(5)
    expect(tall.height).toBe(2180)
    expect(tall.depth).toBe(550)
  })

  it('биік үстіңгі нұсқа Базистегі 1080 мм корпус ретінде жиналады', () => {
    const wall = KITCHEN_EXPANSION_TEMPLATES.find((item) => item.id === 'kitchen-wall-high-1080')
    expect(wall).toBeDefined()
    expect(wall!.height).toBe(1080)
    expect(wall!.depth).toBe(300)
    const panels = generateCabinet(templateToCabinet(wall!, SEED_CATALOG), SEED_CATALOG)
    expect(panels.filter((panel) => panel.role === 'front')).toHaveLength(2)
  })

  it('дереккөздегі ен мен тереңдік қатарының екі шетінде жиналады', () => {
    for (const template of KITCHEN_EXPANSION_TEMPLATES) {
      for (const edge of ['min', 'max'] as const) {
        const size = {
          height: template.range.height[edge],
          width: template.range.width[edge],
          depth: template.range.depth[edge],
        }
        expect(() => generateCabinet(templateToCabinet(template, SEED_CATALOG, size), SEED_CATALOG), template.id).not.toThrow()
      }
    }
  })
})
