/**
 * Тұтас тізбек: шаблон/жиынтық → корпус → раскрой → смета → экспорт.
 *
 * Бөлек модульдер тексерілген, бірақ ЖОБА бүтін өткенде ғана шығатын
 * қателер бар: жаңа өріс сақталмай қалады, деталь id-і қайталанады,
 * жаңа рөл экспортта ұмытылады. Бұл файл соны ұстайды.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  SEED_SETS,
  SEED_TEMPLATES,
  cabinetToDxfFiles,
  cutListToCsv,
  defaultShopProfile,
  findTemplate,
  formatCutList,
  generateCabinet,
  generateHardware,
  mergeProjectPanels,
  nestPanels,
  parseProject,
  priceProject,
  setToProject,
  templateToCabinet,
} from '../src/core/index'
import type { Panel, ProjectFile, ShopProfile } from '../src/core/index'

const catalog = SEED_CATALOG

/** Бағасы толтырылған цех — смета бөгелмеуі үшін. */
const shop: ShopProfile = (() => {
  const base = defaultShopProfile()
  return {
    ...base,
    name: 'Тест',
    materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2_850_000 })),
    edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9_000 })),
    hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 60_000 })),
    labour: { perSquareMetre: 150_000, perHole: 3_000, perEdgeMetre: 5_000 },
    markupPercent: 20,
  }
})()

describe('әр шаблон тізбектің СОҢЫНА дейін өтеді', () => {
  it.each(SEED_TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, template) => {
    const cabinet = templateToCabinet(template, catalog)
    const panels = generateCabinet(cabinet, catalog)
    const hardware = generateHardware(cabinet, catalog)

    // Деталировка
    const rows = formatCutList(panels, catalog)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.reduce((s, r) => s + r.qty, 0)).toBe(panels.length)

    // Раскрой
    const nesting = nestPanels(panels, catalog)
    expect(nesting.unplaced).toEqual([])
    expect(nesting.sheetCount).toBeGreaterThan(0)

    // Смета
    const price = priceProject(panels, nesting, shop, hardware)
    expect(price.missingPrices).toEqual([])
    expect(price.total).toBeGreaterThan(0)

    // Экспорт: әр детальға бір DXF
    const files = cabinetToDxfFiles(panels)
    expect(files.size).toBe(panels.length)
    expect(cutListToCsv(panels, catalog).length).toBeGreaterThan(0)
  })
})

describe('жиынтық та тізбектің соңына дейін өтеді', () => {
  it.each(SEED_SETS.map((s) => [s.id, s] as const))('%s', (_id, preset) => {
    const { cabinets } = setToProject(preset, catalog)
    const panels = mergeProjectPanels(
      cabinets.map((c) => ({ cabinetId: c.id, panels: generateCabinet(c, catalog) })),
    )
    const hardware = cabinets.flatMap((c) => generateHardware(c, catalog))

    // Жиынтықтағы БАРЛЫҚ детальдің id-і бірегей: DXF архивінде бір файл
    // екіншісін басып кетпеуі керек.
    const ids = panels.map((p: Panel) => p.id)
    expect(new Set(ids).size, `қайталанған id: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')}`)
      .toBe(ids.length)

    const nesting = nestPanels(panels, catalog)
    expect(nesting.unplaced).toEqual([])
    const price = priceProject(panels, nesting, shop, hardware)
    expect(price.total).toBeGreaterThan(0)
  })
})

describe('жоба файлы: жаңа өрістер де сақталады', () => {
  /** Барлық жаңа мүмкіндікті бір жобаға жинаймыз. */
  const project: ProjectFile = {
    schemaVersion: 3,
    name: 'Полный проект',
    materials: shop.materials,
    edgeBands: shop.edgeBands,
    settings: {},
    cabinets: [
      templateToCabinet(findTemplate('wardrobe-sliding-1800')!, catalog),
      { ...templateToCabinet(findTemplate('kitchen-base-full-600')!, catalog), id: 'k1' },
      { ...templateToCabinet(findTemplate('bed-frame-1600')!, catalog), id: 'b1' },
    ],
    room: { width: 5000, depth: 4000, height: 2700 },
    placements: [
      { cabinetId: 'cabinet-wardrobe-sliding-1800', wall: 'north', offset: 0 },
      { cabinetId: 'k1', wall: 'east', offset: 0 },
      { cabinetId: 'b1', wall: 'west', offset: 0 },
    ],
  }

  it('сақтап, қайта оқығанда ЕШТЕҢЕ жоғалмайды', () => {
    const round = parseProject(JSON.parse(JSON.stringify(project)))
    expect(round).toEqual(project)
  })

  it('купе, цоколь, столешница мен крышкасыз корпус аман қалады', () => {
    const round = parseProject(JSON.parse(JSON.stringify(project)))
    expect(round.cabinets[0]!.sliding).toEqual({ count: 2 })
    expect(round.cabinets[1]!.base).toEqual({ kind: 'plinth', height: 100 })
    expect(round.cabinets[1]!.worktop).toEqual({ overhangFront: 20, overhangSides: 0 })
    expect(round.cabinets[2]!.openTop).toBe(true)
  })

  it('қайта оқылған жобадан ДӘЛ сол деталировка шығады', () => {
    const round = parseProject(JSON.parse(JSON.stringify(project)))
    for (let i = 0; i < project.cabinets.length; i += 1) {
      expect(formatCutList(generateCabinet(round.cabinets[i]!, catalog), catalog))
        .toEqual(formatCutList(generateCabinet(project.cabinets[i]!, catalog), catalog))
    }
  })
})

describe('жаңа рөлдер экспортта ұмытылмайды', () => {
  const kupe = templateToCabinet(findTemplate('wardrobe-sliding-3-2400')!, catalog)
  const panels = generateCabinet(kupe, catalog)

  it('ящик пен купе детальдары DXF-ке де, CSV-ге де түседі', () => {
    const files = cabinetToDxfFiles(panels)
    const drawerPanels = panels.filter((p: Panel) => p.role.startsWith('drawer'))
    expect(drawerPanels.length).toBeGreaterThan(0)
    for (const panel of drawerPanels) expect(files.has(`${panel.id}.dxf`)).toBe(true)

    const csv = cutListToCsv(panels, catalog)
    expect(csv).toContain('ящика')
    expect(csv).toContain('купе')
  })

  it('әр рөлдің кромкасы анықталған — «белгісіз рөл» қалмайды', () => {
    const roles = new Set(panels.map((p: Panel) => p.role))
    for (const role of roles) {
      const sample = panels.find((p: Panel) => p.role === role)!
      // Кем дегенде бір жиегі шешілген болуы керек (null да — шешім).
      expect(Object.keys(sample.edges)).toEqual(['L1', 'L2', 'W1', 'W2'])
    }
  })
})
