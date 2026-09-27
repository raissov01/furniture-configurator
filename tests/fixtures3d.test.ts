/**
 * Столешницадағы техника (мойка, варочная панель) мен сорғыш.
 *
 * Тексерілетіні: (1) орны КОРПУСТАН шығады — столешницаның үстінде, ал
 * сорғыш нұсқаулықтағы қашықтықта; (2) бәрі клиенттікі — сметаға түспейді;
 * (3) генератор плитаны ящикті тумбаға қояды, үстіне шкаф емес, сорғыш.
 */
import { describe, expect, it } from 'vitest'
import {
  HOOD_CLEARANCE, SEED_CATALOG, findTemplate, generateHardware, generateKitchen, parseProject,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, CabinetFixture, KitchenOptions } from '../src/core/index'
import { referenceProject } from './fixtures'

const base = (fixtures: CabinetFixture[], width = 600): CabinetConfig => ({
  ...templateToCabinet(findTemplate('kitchen-base-full-600')!, SEED_CATALOG, { width, height: 720, depth: 500 }),
  fixtures,
})

/** Столешницаның үсті: корпус + цоколь + столешницаның қалыңдығы. */
const surfaceOf = (c: CabinetConfig) => {
  const t = SEED_CATALOG.materials.find((m) => m.id === c.carcassMaterialId)!.thickness
  return c.height + (c.base?.height ?? 0) + t
}

describe('столешницадағы техника', () => {
  it('мойка мен плита столешницаның ҮСТІНДЕ, әрі сметаға кірмейді', () => {
    for (const fixture of [{ kind: 'sink' as const }, { kind: 'hob' as const, fuel: 'gas' as const }]) {
      const cab = base([fixture])
      const item = generateHardware(cab, SEED_CATALOG).find((h) =>
        h.appliance === (fixture.kind === 'sink' ? 'sink' : 'hobGas'))!
      expect(item.priced).toBe(false)
      expect(item.position.y - item.size!.y / 2).toBe(surfaceOf(cab))
    }
  })

  it('техника модульден шықпайды: екі жағынан кемінде 20 мм', () => {
    const hw = generateHardware(base([{ kind: 'sink' }], 450), SEED_CATALOG)
    const sink = hw.find((h) => h.appliance === 'sink')!
    expect(sink.size!.x).toBeLessThanOrEqual(450 - 40)
  })

  it('сорғыш газдан 750, электрден 650 жоғары, арты қабырғада', () => {
    for (const fuel of ['gas', 'electric'] as const) {
      const cab = base([{ kind: 'hob', fuel }, { kind: 'hood' }])
      const hood = generateHardware(cab, SEED_CATALOG).find((h) => h.appliance === 'hood')!
      expect(hood.position.y - hood.size!.y / 2).toBe(surfaceOf(cab) + HOOD_CLEARANCE[fuel])
      expect(hood.position.z + hood.size!.z / 2).toBe(cab.depth)
    }
  })

  it('тар модульге плита сыймайды — өрісі аталған қате', () => {
    expect(() => generateHardware(base([{ kind: 'hob', fuel: 'gas' }], 400), SEED_CATALOG))
      .toThrow(/Варочная панель/)
  })

  it('мойканың шаблонында мойканың өзі бар', () => {
    const cab = templateToCabinet(findTemplate('kitchen-sink-800')!, SEED_CATALOG)
    expect(cab.fixtures).toEqual([{ kind: 'sink' }])
  })

  it('жоба сақталып қайта ашылғанда техника жоғалмайды', () => {
    const fixtures: CabinetFixture[] = [{ kind: 'hob', fuel: 'electric' }, { kind: 'hood' }]
    const parsed = parseProject({
      ...referenceProject,
      cabinets: [{ ...referenceProject.cabinets[0]!, fixtures }],
    })
    expect(parsed.cabinets[0]!.fixtures).toEqual(fixtures)
  })
})

describe('ас үй генераторы: плита, сорғыш, мойка', () => {
  const kitchen = (extra: Partial<KitchenOptions> = {}) =>
    generateKitchen({ layout: 'straight', lengthA: 4200, sink: true, upper: true, appliances: true, ...extra }, SEED_CATALOG)

  it('барлық техника өз түрімен шығады', () => {
    const r = kitchen()
    const kinds = new Set(r.cabinets.flatMap((c) => generateHardware(c, SEED_CATALOG)).map((h) => h.appliance))
    for (const k of ['fridge', 'oven', 'microwave', 'dishwasher', 'sink', 'hobGas']) {
      expect(kinds.has(k as never)).toBe(true)
    }
    // Бөлек «труба» сорғыш — тек үстіңгі қатарсыз (09-13: үстіңгі қатарда
    // плитаның үстінде сорғыш шкафы тұрады, qdesign сияқты).
    expect(kinds.has('hood' as never)).toBe(false)
    const flat = kitchen({ upper: false })
    const flatKinds = new Set(flat.cabinets.flatMap((c) => generateHardware(c, SEED_CATALOG)).map((h) => h.appliance))
    expect(flatKinds.has('hood' as never)).toBe(true)
  })

  it('плита ЯЩИКТІ тумбада, мойкадан бөлек, үстінде — СОРҒЫШ ШКАФЫ', () => {
    const r = kitchen()
    const hobCab = r.cabinets.find((c) => c.fixtures?.some((f) => f.kind === 'hob'))!
    expect(hobCab.sections.some((s) => s.contents.some((c) => c.kind === 'drawers'))).toBe(true)
    expect(hobCab.fixtures?.some((f) => f.kind === 'sink')).toBe(false)
    const at = r.placements.find((p) => p.cabinetId === hobCab.id)!
    const above = r.placements.filter((p) => p.wall === at.wall && p.offset === at.offset && (p.elevation ?? 0) > 0)
    // Жай үстіңгі шкаф емес — ортасында труба қорабы бар сорғыш шкафы.
    expect(above).toHaveLength(1)
    const hood = r.cabinets.find((c) => c.id === above[0]!.cabinetId)!
    expect(hood.sections[0]!.contents.some((c) => c.kind === 'stand')).toBe(true)
  })

  it('600 мм плитаға негізгі қабырғада орын сақталады (бұрыш 3000 × 2400)', () => {
    const r = generateKitchen({ layout: 'corner', lengthA: 3000, lengthB: 2400 }, SEED_CATALOG)
    const hobs = r.cabinets.filter((c) => c.fixtures?.some((f) => f.kind === 'hob'))
    expect(hobs).toHaveLength(1)
    const wall = r.placements.find((p) => p.cabinetId === hobs[0]!.id)!.wall
    expect(wall).toBe('north')
    expect(hobs[0]!.width).toBeGreaterThanOrEqual(600)
    // Плитаның үстінде сорғыш ШКАФЫ (qdesign сияқты), бөлек «труба» жоқ.
    expect(hobs[0]!.fixtures?.some((f) => f.kind === 'hood')).toBe(false)
    /*
     * K8 / audit C6+C7 (2026-09-20): бұрышта шығыс қатардың төменгі мен
     * үстіңгі жолы бастапқы ЫҒЫСУЫ ӘДЕЙІ бөлек (`qLower` ≠ `qUpper`,
     * kitchen.ts) — төменгі бұрыштық корпус тереңірек (500 мм), сондықтан
     * шығыс қатарды үстіңгіге (320 мм) қарағанда алысырақ бастатады. Сол
     * себепті «дәл сол offset» іздеу орнына генератордың ӨЗ ретін
     * қолданамыз: төменгі орналасудан кейін бірден келетін орналасу — сол
     * модульдің үстіңгісі.
     */
    const at = r.placements.find((p) => p.cabinetId === hobs[0]!.id)!
    const atIndex = r.placements.indexOf(at)
    const next = r.placements[atIndex + 1]
    const above = next && next.wall === at.wall && (next.elevation ?? 0) > 0 ? [next] : []
    expect(above).toHaveLength(1)
  })

  it('мойка гарнитурда ДӘЛ бір рет (шаблон мен генератор қайталамайды)', () => {
    const sinks = kitchen().cabinets.flatMap((c) => c.fixtures ?? []).filter((f) => f.kind === 'sink')
    expect(sinks).toHaveLength(1)
  })

  it('электр плита мен сорғышсыз нұсқа', () => {
    const fixtures = kitchen({ hob: 'electric', hood: false }).cabinets.flatMap((c) => c.fixtures ?? [])
    expect(fixtures).toContainEqual({ kind: 'hob', fuel: 'electric' })
    expect(fixtures.some((f) => f.kind === 'hood')).toBe(false)
  })

  it('hob: none — плита да, сорғыш та жоқ', () => {
    const fixtures = kitchen({ hob: 'none' }).cabinets.flatMap((c) => c.fixtures ?? [])
    expect(fixtures.some((f) => f.kind === 'hob' || f.kind === 'hood')).toBe(false)
  })

  it('техникасыз гарнитурда плита әдепкіде жоқ (бұрынғы мінез)', () => {
    const fixtures = kitchen({ appliances: false }).cabinets.flatMap((c) => c.fixtures ?? [])
    expect(fixtures.some((f) => f.kind === 'hob')).toBe(false)
  })
})
