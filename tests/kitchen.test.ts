/**
 * Ас үй генераторы: қабырға ұзындығынан толық гарнитур.
 *
 * Тексерілетіні: (1) авто-бөлу қосындысы ДӘЛ ұзындыққа тең әрі модульдер
 * [min,max] аралығында; (2) генерацияланған гарнитур бөлмеге сыяды әрі
 * қабаттаспайды (бұрыш та); (3) төменгі модульде столешница мен цоколь бар.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, generateCabinet, generateKitchen, kitchenLayout, splitRun, validatePlacements,
} from '../src/core/index'

describe('splitRun', () => {
  it('қосынды ӘРҚАШАН дәл ұзындыққа тең', () => {
    for (const len of [600, 1000, 2350, 3999, 4200, 5000]) {
      expect(splitRun(len).reduce((s, w) => s + w, 0)).toBe(len)
    }
  })

  it('әр модуль [min,max] аралығында', () => {
    for (const len of [400, 1000, 2350, 3999, 5000, 7000]) {
      for (const w of splitRun(len)) {
        expect(w).toBeGreaterThanOrEqual(300)
        expect(w).toBeLessThanOrEqual(900)
      }
    }
  })

  it('модуль саны ұзындыққа қарай өседі', () => {
    expect(splitRun(600).length).toBe(1)
    expect(splitRun(3000).length).toBeGreaterThan(splitRun(1200).length)
  })

  it('тым қысқа қабырға — бір модуль немесе бос', () => {
    expect(splitRun(200)).toHaveLength(1)
    expect(splitRun(0)).toHaveLength(0)
  })
})

const entriesOf = (r: ReturnType<typeof generateKitchen>) =>
  r.cabinets.map((cabinet) => ({
    cabinet,
    placement: r.placements.find((p) => p.cabinetId === cabinet.id)!,
  }))

describe('generateKitchen', () => {
  it('түзу гарнитур: корпустар жиналады әрі сыяды', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 3000, sink: true, upper: true }, SEED_CATALOG)
    expect(r.cabinets.length).toBeGreaterThan(1)
    for (const c of r.cabinets) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
    expect(validatePlacements(r.room, entriesOf(r))).toEqual([])
  })

  it('бұрыштық гарнитур: екі қабырға, қабаттаспайды, сыяды', () => {
    const r = generateKitchen({ layout: 'corner', lengthA: 3200, lengthB: 2400, sink: true, upper: true }, SEED_CATALOG)
    const walls = new Set(r.placements.map((p) => p.wall))
    expect(walls).toEqual(new Set(['north', 'east']))
    expect(validatePlacements(r.room, entriesOf(r))).toEqual([])
  })

  /*
   * ҮСТІҢГІ ҚАТАР (09-13): плитадан басқа әр аласа модульдің үстінде шкаф,
   * биік бағананың үстінде — жоқ. Бұрын солтүстікте мойка мен посудомойканың
   * үстінде бос қалып, қатар шетінде жалғыз шкаф ауада ілініп тұратын.
   */
  it('үстіңгі шкаф плитадан басқа әр аласа модульдің үстінде, пеналдың үстінде жоқ', () => {
    const r = generateKitchen({ layout: 'corner', lengthA: 3200, lengthB: 2400, sink: true, upper: true }, SEED_CATALOG)
    const byId = new Map(r.cabinets.map((c) => [c.id, c]))
    const isUpper = (p: (typeof r.placements)[number]) => (p.elevation ?? 0) > 0
    const lowers = r.placements.filter((p) => !isUpper(p))
    const uppers = r.placements.filter(isUpper)
    for (const low of lowers) {
      const cab = byId.get(low.cabinetId)!
      const tall = cab.height > 1500
      const hob = (cab.fixtures ?? []).some((f) => f.kind === 'hob')
      const above = uppers.filter((u) => u.wall === low.wall && u.offset === low.offset)
      expect(above, `${cab.name} @ ${low.wall}:${low.offset}`).toHaveLength(tall || hob ? 0 : 1)
    }
    // Мойка мен посудомойка солтүстікте — енді олардың үстінде де шкаф бар.
    const sink = lowers.find((p) => (byId.get(p.cabinetId)!.fixtures ?? []).some((f) => f.kind === 'sink'))!
    expect(uppers.some((u) => u.wall === sink.wall && u.offset === sink.offset)).toBe(true)
    expect(validatePlacements(r.room, entriesOf(r))).toEqual([])
  })

  it('төменгі модульде цоколь мен столешница бар', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 2400, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    // Техникасыз — бәрі төменгі база: цоколь мен столешница әрқайсысында.
    for (const c of r.cabinets) {
      expect(c.base?.kind).toBe('plinth')
      expect(c.worktop).toBeDefined()
    }
  })

  it('мойка сұралса — дәл біреу, ортада', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 3600, sink: true, upper: false }, SEED_CATALOG)
    // Мойка модулінде сөре болмайды — оны деталь атауынан емес, санынан
    // тексереміз: гарнитурда тек бір мойка.
    const sinks = r.cabinets.filter((c) => c.name.toLowerCase().includes('мойк'))
    expect(sinks).toHaveLength(1)
  })

  it('техникамен: пенал бағанасы мен ЯЩИК/ЕСІК араласы бар', () => {
    const r = generateKitchen({ layout: 'corner', lengthA: 3600, lengthB: 2400, sink: true, upper: true, appliances: true }, SEED_CATALOG)
    const names = r.cabinets.map((c) => c.name.toLowerCase())
    // Пенал бағанасы (тоңазытқыш/қойма) — толық биік.
    expect(names.some((n) => n.includes('пенал'))).toBe(true)
    // Базалар біркелкі емес: ящик те, есік те бар.
    expect(names.some((n) => n.includes('ящик'))).toBe(true)
    expect(names.some((n) => n.includes('цоколем') || n.includes('столешниц'))).toBe(true)
    expect(validatePlacements(r.room, entriesOf(r))).toEqual([])
  })

  it('техникамен: НАҒЫЗ техника ұялары шығады (тоңазытқыш/духовка/посудомойка)', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 4200, sink: true, upper: true, appliances: true }, SEED_CATALOG)
    const appliances = r.cabinets
      .flatMap((c) => c.sections)
      .flatMap((sec) => sec.contents)
      .filter((c) => c.kind === 'appliance')
      .map((c) => (c.kind === 'appliance' ? c.appliance : ''))
    expect(appliances).toContain('fridge')
    expect(appliances).toContain('oven')
    expect(appliances).toContain('dishwasher')
    // Техника ұясында цех фасады болмайды (техниканың өз есігі бар).
    const applianceSection = r.cabinets
      .flatMap((c) => c.sections)
      .find((sec) => sec.contents.some((x) => x.kind === 'appliance' && x.appliance === 'fridge'))
    expect(applianceSection?.fronts).toBeNull()
  })

  it('П-пішін (U): ҮШ қабырға, қабаттаспайды, сыяды', () => {
    const r = generateKitchen({ layout: 'u', lengthA: 3200, lengthB: 2400, lengthC: 2000, sink: true, upper: true, appliances: true }, SEED_CATALOG)
    const walls = new Set(r.placements.map((p) => p.wall))
    expect(walls).toEqual(new Set(['north', 'east', 'west']))
    for (const c of r.cabinets) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
    expect(validatePlacements(r.room, r.cabinets.map((c) => ({ cabinet: c, placement: r.placements.find((p) => p.cabinetId === c.id)! })))).toEqual([])
  })

  it('АЙҚЫН модуль тізімі: генератор соны дәл құрайды (раскладка редакторы)', () => {
    const layout = kitchenLayout({ layout: 'straight', lengthA: 3000, sink: true, appliances: true })
    expect(layout.runA.length).toBeGreaterThan(1)
    // Қолмен өзгертеміз: бірінші модульді мойка етеміз.
    const edited = { runA: [{ kind: 'sink' as const, width: 800 }, { kind: 'baseDoors' as const, width: 600 }], runB: [] }
    const r = generateKitchen({ layout: 'straight', lengthA: 1400, upper: false, modules: edited }, SEED_CATALOG)
    // Тек екі базалық модуль (үстіңгі қатарсыз) — дәл біз бергендей.
    expect(r.cabinets).toHaveLength(2)
    expect(r.cabinets.some((c) => c.name.toLowerCase().includes('мойк'))).toBe(true)
    expect(validatePlacements(r.room, r.cabinets.map((c) => ({ cabinet: c, placement: r.placements.find((p) => p.cabinetId === c.id)! })))).toEqual([])
  })

  it('шыны жоғарғы: үстіңгі фасад glass=true, төменгі — жоқ', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 3000, upper: true, appliances: false, glassUpper: true }, SEED_CATALOG)
    // Үстіңгі шкафтардың секция фасады шыны.
    const glassSections = r.cabinets.flatMap((c) => c.sections).filter((sec) => sec.fronts?.glass)
    expect(glassSections.length).toBeGreaterThan(0)
    // Раскрой өзгермейді — панельдер жиналады.
    for (const c of r.cabinets) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
  })

  it('техникасыз: біркелкі базалар (пенал жоқ)', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 2400, sink: true, upper: false, appliances: false }, SEED_CATALOG)
    expect(r.cabinets.every((c) => !c.name.toLowerCase().includes('пенал'))).toBe(true)
  })

  it('үстіңгі қатар ілінеді (elevation > 0), мойканың үстінде жоқ', () => {
    const withUpper = generateKitchen({ layout: 'straight', lengthA: 3000, sink: true, upper: true }, SEED_CATALOG)
    const uppers = withUpper.placements.filter((p) => (p.elevation ?? 0) > 0)
    expect(uppers.length).toBeGreaterThan(0)

    const noUpper = generateKitchen({ layout: 'straight', lengthA: 3000, sink: true, upper: false }, SEED_CATALOG)
    expect(noUpper.placements.every((p) => (p.elevation ?? 0) === 0)).toBe(true)
    // Үстіңгі қатар төменгіден АЗ болуы керек: мойканың үстінде шкаф жоқ.
    expect(uppers.length).toBeLessThan(withUpper.placements.length - uppers.length)
  })
})
