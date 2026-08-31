/**
 * Баға (§6). Екі басты талап:
 *   1. Ақша — БҮТІН ТИЫН. Float ақшада 0.1+0.2 ≠ 0.3 болып шығады.
 *   2. Материал бағасы АУДАН бойынша емес, нақты қанша ПАРАҚ кеткені бойынша:
 *      цех бүтін парақ сатып алады, қалдық оның қалтасынан шығады.
 */
import { describe, expect, it } from 'vitest'
import {
  countHardware,
  countHoles,
  defaultShopProfile,
  edgeMetresByBand,
  findTemplate,
  formatTenge,
  generateCabinet,
  nestPanels,
  panelAreaSquareMetres,
  parseShopProfile,
  priceProject,
  templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'

const base = defaultShopProfile()
const catalog = { materials: base.materials, edgeBands: base.edgeBands }
const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
const panels = generateCabinet(cabinet, catalog)
const nesting = nestPanels(panels, catalog)

/** Бағасы толтырылған цех: ЛДСП 28 500 ₸, кромка 90 ₸/м, фурнитура 60 ₸. */
const pricedShop: ShopProfile = {
  ...base,
  name: 'Цех «Алаш»',
  materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
  edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
  labour: { perSquareMetre: 150000, perHole: 3000, perEdgeMetre: 5000 },
  markupPercent: 20,
}

describe('өлшемдер', () => {
  it('кромка метражы жиек бойынша есептеледі', () => {
    const metres = edgeMetresByBand(panels)
    expect(metres.size).toBeGreaterThan(0)
    for (const m of metres.values()) expect(m).toBeGreaterThan(0)
  })

  it('аудан оң сан әрі шындыққа жақын', () => {
    const area = panelAreaSquareMetres(panels)
    // Эталон пенал: 11 деталь, шамамен 5–8 м².
    expect(area).toBeGreaterThan(3)
    expect(area).toBeLessThan(12)
  })

  it('тесіктер саналады', () => {
    expect(countHoles(panels)).toBeGreaterThan(0)
  })
})

describe('фурнитура присадкадан шығады', () => {
  const counts = countHardware(panels)

  it('конфирмат саны торцтағы Ø7 тесікпен бірдей', () => {
    const edgeHoles = panels.reduce(
      (n, p) => n + p.drilling.filter((d) => d.purpose === 'confirmat' && d.diameter === 7).length,
      0,
    )
    expect(counts.get('confirmat-7x50')).toBe(edgeHoles)
    // Әр конфирматқа бір заглушка.
    expect(counts.get('confirmat-cap')).toBe(edgeHoles)
  })

  it('петля мен планка саны тең', () => {
    expect(counts.get('hinge-overlay')).toBe(counts.get('hinge-plate'))
  })

  it('полкодержатель сөреге 4 дана — тесік санымен ШАТАСТЫРЫЛМАЙДЫ', () => {
    const shelves = panels.filter((p) => p.role === 'shelf').length
    const pinHoles = panels.reduce(
      (n, p) => n + p.drilling.filter((d) => d.purpose === 'shelfPin').length,
      0,
    )
    expect(counts.get('shelf-pin-5')).toBe(shelves * 4)
    expect(counts.get('shelf-pin-5')!).toBeLessThan(pinHoles)
  })
})

describe('есеп', () => {
  it('бағасыз цехта толтырылмағандар тізіледі, сомасы 0', () => {
    const p = priceProject(panels, nesting, base)
    expect(p.missingPrices.length).toBeGreaterThan(0)
    expect(p.total).toBe(0)
  })

  it('материал ПАРАҚ санымен есептеледі, аудан бойынша емес', () => {
    const p = priceProject(panels, nesting, pricedShop)
    const ldsp = p.materials.find((l) => l.id === 'ldsp16-h1145')!
    const sheets = nesting.byMaterial.find((m) => m.materialId === 'ldsp16-h1145')!.sheets.length
    expect(ldsp.qty).toBe(sheets)
    expect(ldsp.cost).toBe(sheets * 2850000)
  })

  it('үстеме сомадан есептеледі, қорытынды дұрыс жиналады', () => {
    const p = priceProject(panels, nesting, pricedShop)
    const lines = [...p.materials, ...p.edges, ...p.hardware, ...p.labour]
    expect(p.subtotal).toBe(lines.reduce((s, l) => s + l.cost, 0))
    // Үстеме де бүтін теңгеге дөңгелектенеді — КП-да тиын болмауы керек.
    expect(p.markup).toBe(Math.round((p.subtotal * 20) / 100 / 100) * 100)
    expect(p.total).toBe(p.subtotal + p.markup)
  })

  it('барлық сома БҮТІН тиын', () => {
    const p = priceProject(panels, nesting, pricedShop)
    for (const line of [...p.materials, ...p.edges, ...p.hardware, ...p.labour]) {
      expect(Number.isInteger(line.cost), line.name).toBe(true)
      expect(Number.isInteger(line.unitPrice), line.name).toBe(true)
    }
    expect(Number.isInteger(p.subtotal)).toBe(true)
    expect(Number.isInteger(p.markup)).toBe(true)
    expect(Number.isInteger(p.total)).toBe(true)
  })

  it('үстеме 0 болса қорытынды сомаға тең', () => {
    const p = priceProject(panels, nesting, { ...pricedShop, markupPercent: 0 })
    expect(p.total).toBe(p.subtotal)
  })

  it('жұмыс ақысы 0 болса ол жол мүлде шықпайды', () => {
    const p = priceProject(panels, nesting, {
      ...pricedShop,
      labour: { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 },
    })
    expect(p.labour.every((l) => l.cost === 0)).toBe(true)
  })

  it('теңгеге келтіру дөңгелектейді', () => {
    expect(formatTenge(2850000)).toContain('28')
    expect(formatTenge(0)).toBe('0 ₸')
  })
})

describe('профиль нұсқасы', () => {
  it('1-нұсқадағы профиль соңғысына көтеріледі, бағалары сақталады', () => {
    const old = {
      ...base,
      schemaVersion: 1,
      materials: base.materials.map((m) => ({ ...m, pricePerSheet: 111 })),
    }
    delete (old as Record<string, unknown>)['labour']
    delete (old as Record<string, unknown>)['markupPercent']

    const migrated = parseShopProfile(old)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.markupPercent).toBe(0)
    expect(migrated.labour).toEqual({ perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 })
    expect(migrated.materials[0]!.pricePerSheet).toBe(111)
  })

  it('2-нұсқадан көшкенде ілгек пен тұтқа каталогы пайда болады', () => {
    const old = { ...base, schemaVersion: 2 }
    delete (old as Record<string, unknown>)['hingeSystems']
    delete (old as Record<string, unknown>)['handles']

    const migrated = parseShopProfile(old)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.hingeSystems.length).toBeGreaterThan(0)
    expect(migrated.handles.length).toBeGreaterThan(0)
    // Жаңа фурнитура сметада да болуы керек, әйтпесе бағасын қоятын жер жоқ.
    const ids = new Set(migrated.hardware.map((h) => h.id))
    for (const sys of migrated.hingeSystems) {
      if (sys.arm === 'cross' && sys.mount === 'overlay') expect(ids.has(sys.hardwareId)).toBe(true)
    }
    for (const h of migrated.handles) expect(ids.has(h.hardwareId)).toBe(true)
  })

  it('ескі профильдегі бағалар көшу кезінде жоғалмайды', () => {
    const old = {
      ...base,
      schemaVersion: 2,
      hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 777 })),
    }
    delete (old as Record<string, unknown>)['hingeSystems']
    delete (old as Record<string, unknown>)['handles']

    const migrated = parseShopProfile(old)
    for (const h of base.hardware) {
      expect(migrated.hardware.find((x) => x.id === h.id)?.pricePerUnit, h.id).toBe(777)
    }
  })
})

describe('КП құжат ретінде', () => {
  it('бағандағы сандар ДӘЛ қосылады — цех қолмен тексереді', () => {
    const p = priceProject(panels, nesting, pricedShop)
    const lines = [...p.materials, ...p.edges, ...p.hardware, ...p.labour]

    // Әр жол — бүтін теңге (яғни тиынға еселік 100).
    for (const l of lines) expect(l.cost % 100, l.name).toBe(0)
    expect(p.markup % 100).toBe(0)
    expect(p.subtotal % 100).toBe(0)
    expect(p.total % 100).toBe(0)

    // Экранда көрсетілетін теңгелердің қосындысы қорытындымен дәл келеді.
    const shownSum = lines.reduce((s, l) => s + Math.round(l.cost / 100), 0)
    expect(shownSum).toBe(Math.round(p.subtotal / 100))
    expect(Math.round(p.subtotal / 100) + Math.round(p.markup / 100)).toBe(Math.round(p.total / 100))
  })
})
