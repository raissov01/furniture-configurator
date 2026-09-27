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

  it('конфирмат саны ТОРЦТАҒЫ тесікпен бірдей', () => {
    // Бір конфирмат = екі тесік: беттегі өтпелі + торцтағы пилот. Санақ
    // торцпен жүреді — диаметр ауысса да (2026-09-02) бұл өзгермейді.
    const edgeHoles = panels.reduce(
      (n, p) => n + p.drilling.filter((d) => d.purpose === 'confirmat' && d.face.startsWith('edge')).length,
      0,
    )
    expect(counts.get('confirmat-7x50')).toBe(edgeHoles)
    // Әр конфирматқа бір заглушка.
    expect(counts.get('confirmat-cap')).toBe(edgeHoles)
  })

  it('петля мен планка саны тең', () => {
    expect(counts.get('hinge-overlay')).toBe(counts.get('hinge-plate'))
  })

  it('артикулмен берілген ілгектің жауап планкасын да санайды', () => {
    const branded = panels.map((panel) => ({ ...panel, drilling: panel.drilling.map((hole) =>
      hole.purpose === 'hinge' && hole.diameter === 35
        ? { ...hole, hardwareId: 'hettich-sensys-8645i-overlay-press-in' }
        : hole) }))
    const brandedCounts = countHardware(branded)
    expect(brandedCounts.get('hettich-sensys-8645i-overlay-press-in')).toBe(counts.get('hinge-overlay'))
    expect(brandedCounts.get('hinge-plate')).toBe(counts.get('hinge-overlay'))
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

  it('конфирматқа бекітілген сөреге полкодержатель қоспайды', () => {
    const fixed = { ...cabinet, sections: cabinet.sections.map((section) => ({
      ...section, contents: [{ kind: 'shelves' as const, count: 2, shelfKind: 'fixed' as const }],
    })) }
    for (const carcassJoint of ['confirmat', 'minifix'] as const) {
      const fixedPanels = generateCabinet({ ...fixed, carcassJoint }, catalog)
      expect(fixedPanels.filter((p) => p.role === 'shelf')).toHaveLength(2)
      expect(countHardware(fixedPanels).get('shelf-pin-5')).toBeUndefined()
      expect(countHardware(fixedPanels).get(carcassJoint === 'minifix' ? 'minifix-15' : 'confirmat-7x50'))
        .toBeGreaterThan(0)
    }
  })

  it('аралас корпуста ұстағыш тек реттелетін сөреге (бекітілген сөре мен бөлгішке емес)', () => {
    const mixed = generateCabinet(templateToCabinet(findTemplate('wardrobe-sliding-1800')!, catalog), catalog)
    const shelves = mixed.filter((p) => p.role === 'shelf')
    const adjustable = shelves.filter((p) => p.shelfKind === 'adjustable').length
    expect(adjustable).toBeGreaterThan(0)
    expect(shelves.length).toBeGreaterThan(adjustable)
    expect(countHardware(mixed).get('shelf-pin-5')).toBe(adjustable * 4)
  })

  it('сөре белгісінің мәтіні өзгерсе де ұстағыш санын присадка мен түрінен шығарады', () => {
    const renamed = panels.map((p) => p.role === 'shelf' ? { ...p, note: 'Shelf' } : p)
    expect(countHardware(renamed).get('shelf-pin-5')).toBe(16)
    const withoutPinHoles = renamed.map((p) => ({ ...p, drilling: p.drilling.filter((d) => d.purpose !== 'shelfPin') }))
    expect(countHardware(withoutPinHoles).get('shelf-pin-5')).toBeUndefined()
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
    const lines = [...p.materials, ...p.edges, ...p.hardware, ...p.services]
    expect(p.subtotal).toBe(lines.reduce((s, l) => s + l.cost, 0))
    // Үстеме де бүтін теңгеге дөңгелектенеді — КП-да тиын болмауы керек.
    expect(p.markup).toBe(Math.round((p.subtotal * 20) / 100))
    expect(p.total).toBe(p.subtotal + p.markup)
  })

  it('барлық сома БҮТІН тиын', () => {
    const p = priceProject(panels, nesting, pricedShop)
    for (const line of [...p.materials, ...p.edges, ...p.hardware, ...p.services]) {
      expect(Number.isInteger(line.cost), line.name).toBe(true)
      expect(Number.isInteger(line.unitPrice), line.name).toBe(true)
    }
    expect(Number.isInteger(p.subtotal)).toBe(true)
    expect(Number.isInteger(p.markup)).toBe(true)
    expect(Number.isInteger(p.total)).toBe(true)
  })

  it('парақ бағасындағы тиынды сақтайды және көрсетеді', () => {
    const shop = { ...pricedShop, materials: pricedShop.materials.map((m) => ({ ...m, pricePerSheet: 101 })) }
    const price = priceProject(panels, nesting, shop)
    for (const line of price.materials) {
      expect(line.cost).toBe(line.qty * 101)
    }
    expect(formatTenge(101)).toBe('1,01 ₸')
    expect(formatTenge(-101)).toBe('−1,01 ₸')
  })

  it('qty екі болса, аудан, тесік, қызмет және фурнитура саны екі еселенеді', () => {
    const doubled = panels.map((p) => ({ ...p, qty: p.qty * 2 }))
    const doubledNesting = nestPanels(doubled, catalog)
    const original = priceProject(panels, nesting, pricedShop)
    const twice = priceProject(doubled, doubledNesting, pricedShop)
    expect(countHoles(doubled)).toBe(2 * countHoles(panels))
    expect([...countHardware(doubled)]).toEqual([...countHardware(panels)].map(([id, qty]) => [id, qty * 2]))
    for (const row of original.byMaterial) {
      const other = twice.byMaterial.find((candidate) => candidate.materialId === row.materialId)!
      expect(other.panels).toBe(row.panels * 2)
      expect(other.holes).toBe(row.holes * 2)
      expect(other.areaSquareMetres).toBeCloseTo(row.areaSquareMetres * 2, 1)
    }
  })

  it('әр есеп жолы нақты панельге немесе орналастыруға тиынмен бөлінеді', () => {
    const price = priceProject(panels, nesting, pricedShop)
    const ids = new Set(panels.map((panel) => panel.id))
    for (const line of [...price.materials, ...price.edges, ...price.hardware, ...price.services]) {
      expect(line.sources?.length, line.name).toBeGreaterThan(0)
      expect(line.sources!.reduce((sum, source) => sum + source.cost, 0), line.name).toBe(line.cost)
      for (const source of line.sources!) {
        expect(ids.has(source.panelId!), line.name).toBe(true)
        expect(Number.isInteger(source.cost)).toBe(true)
        expect(source.cost).toBeGreaterThanOrEqual(0)
      }
    }
    const holes = price.services.find((line) => line.id === 'service-drilling')
    if (holes?.unit === 'отв') {
      expect(holes.sources!.reduce((sum, source) => sum + source.qty, 0)).toBe(countHoles(panels))
    }
    const cheap = { ...pricedShop, materials: pricedShop.materials.map((m) => ({ ...m, pricePerSheet: 1 })) }
    for (const line of priceProject(panels, nesting, cheap).materials) {
      expect(line.sources!.every((source) => source.cost >= 0)).toBe(true)
    }
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
    expect(p.services.every((l) => l.cost === 0)).toBe(true)
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
    expect(migrated.schemaVersion).toBe(10)
    expect(migrated.markupPercent).toBe(0)
    expect(migrated.services.cutting.rate).toBe(0)
    expect(migrated.coefficient).toBe(1)
    expect(migrated.materials[0]!.pricePerSheet).toBe(111)
  })

  it('2-нұсқадан көшкенде ілгек пен тұтқа каталогы пайда болады', () => {
    const old = { ...base, schemaVersion: 2 }
    delete (old as Record<string, unknown>)['hingeSystems']
    delete (old as Record<string, unknown>)['handles']

    const migrated = parseShopProfile(old)
    expect(migrated.schemaVersion).toBe(10)
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
    expect(migrated.schemaVersion).toBe(10)
    for (const h of base.hardware) {
      expect(migrated.hardware.find((x) => x.id === h.id)?.pricePerUnit, h.id).toBe(777)
    }
  })
})

describe('КП құжат ретінде', () => {
  it('бағандағы сандар ДӘЛ қосылады — цех қолмен тексереді', () => {
    const p = priceProject(panels, nesting, pricedShop)
    const lines = [...p.materials, ...p.edges, ...p.hardware, ...p.services]

    // Әр жол бүтін тиын, көрсетілген тиындар қорытындыға дәл қосылады.
    for (const l of lines) expect(Number.isInteger(l.cost), l.name).toBe(true)
    expect(lines.reduce((s, l) => s + l.cost, 0)).toBe(p.subtotal)
    expect(p.subtotal + p.markup).toBe(p.total)
  })
})
