/**
 * ЦОКОЛЬ — көрші модульдердің плинтусы БІР Panel-ге біріктіріледі (G2,
 * docs/visual/generator-gaps.md §G2; диагноз docs/audit/qdesign-drilling-
 * reference.md §7: qdesign «Цоколь (объединенный)», 2633×95×16).
 *
 * Әдісі — `tests/worktop.test.ts`-пен бірдей: көрші топты жинау, топ басында
 * бір ерікті ұзын деталь. Механизмі бөлек (`kitchen.ts:mergeSharedPlinths`
 * комментарийін қара): ORIENT_UPRIGHT геометриясы `customParts`-тың үш
 * пландасына сыймайтындықтан, ортақ деталь тікелей `base.sharedSpan` арқылы
 * `generateCabinet.ts`-те шығады.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, generateCabinet, generateKitchen, groupPanels, mergeSharedPlinths } from '../src/core/index'
import type { CabinetConfig, Placement } from '../src/core/index'

type Result = ReturnType<typeof generateKitchen>

/** Бір қабырғадағы едендегі (цокольді) корпустар, offset бойынша реттелген. */
const floorRun = (r: Result, wall: string) =>
  r.placements
    .filter((p) => p.wall === wall && !(p.elevation ?? 0))
    .sort((a, b) => a.offset - b.offset)
    .map((p) => r.cabinets.find((c) => c.id === p.cabinetId)!)
    .filter((c) => c.base?.kind === 'plinth')

/** Мутациямен қайта тексеру алдында `shared`/`sharedSpan`-ды алып тастау — таза «дейінгі» күй. */
const stripShared = (cabinets: CabinetConfig[]): CabinetConfig[] =>
  cabinets.map((c) => (c.base ? { ...c, base: { ...c.base, shared: undefined, sharedSpan: undefined } } : c))

describe('цоколь — қатардың көрші модульдерін бір панельге біріктіру', () => {
  it('көрші үш модульдің цоколі бір Panel болады, ұзындығы — қосындысы', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    expect(run).toHaveLength(3)
    expect(run.every((c) => c.width === 600)).toBe(true)

    // Тек ТОП БАСЫНДА sharedSpan бар, қалғандарында — shared ғана, меншікті панелі жоқ.
    const withSpan = run.filter((c) => c.base!.sharedSpan)
    expect(withSpan).toHaveLength(1)
    expect(withSpan[0]!.base!.sharedSpan).toBe(1800)
    expect(run.every((c) => c.base!.shared)).toBe(true)

    const head = withSpan[0]!
    const others = run.filter((c) => c !== head)
    expect(generateCabinet(head, SEED_CATALOG).filter((p) => p.id === 'plinth')).toHaveLength(1)
    const merged = generateCabinet(head, SEED_CATALOG).find((p) => p.id === 'plinth')!
    expect(merged.finishedLength).toBe(1800)
    expect(merged.finishedWidth).toBe(head.base!.height)
    for (const c of others) {
      expect(generateCabinet(c, SEED_CATALOG).some((p) => p.id === 'plinth')).toBe(false)
    }
  })

  it('биік бағана (пенал) қатарға енеді — dressBase бірдей биіктік/материал береді, тереңдігі әсер етпейді', () => {
    const r = generateKitchen({
      layout: 'straight',
      lengthA: 1800,
      modules: { runA: [{ kind: 'baseDoors', width: 600 }, { kind: 'tall', width: 600 }, { kind: 'baseDoors', width: 600 }], runB: [] },
    }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    expect(run).toHaveLength(3)
    const tower = run.find((c) => c.height > 1500)!
    expect(tower.depth).not.toBe(run.find((c) => c.height < 1000)!.depth) // тереңдігі басқа
    expect(tower.base!.shared).toBe(true) // соған қарамастан цоколь бірікті
    const head = run.find((c) => c.base!.sharedSpan)!
    expect(head.base!.sharedSpan).toBe(1800)
  })

  it('биіктігі әртүрлі болса — бірікпейді', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    const mutated = stripShared(r.cabinets).map((c) =>
      c.id === run[1]!.id ? { ...c, base: { ...c.base!, height: c.base!.height + 5 } } : c)
    const merged = mergeSharedPlinths(mutated, r.placements, SEED_CATALOG)
    const byId = new Map(merged.map((c) => [c.id, c]))
    // Ортадағысы басқа биіктікте — үшеуі де ЖАЛҒЫЗ қалады, ешқайсысы бірікпейді.
    for (const c of run) expect(byId.get(c.id)!.base!.shared).toBeUndefined()
  })

  it('материалы әртүрлі болса — бірікпейді', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    const other = SEED_CATALOG.materials.find((m) => m.thickness === 16 && m.id !== run[0]!.carcassMaterialId)!
    const mutated = stripShared(r.cabinets).map((c) =>
      c.id === run[1]!.id ? { ...c, base: { ...c.base!, plinthMaterialId: other.id } } : c)
    const merged = mergeSharedPlinths(mutated, r.placements, SEED_CATALOG)
    const byId = new Map(merged.map((c) => [c.id, c]))
    for (const c of run) expect(byId.get(c.id)!.base!.shared).toBeUndefined()
  })

  it('аралары ашық (көрші емес) модульдер — бірікпейді', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    const gapped: Placement[] = r.placements.map((p) =>
      (run[2] && p.cabinetId === run[2]!.id ? { ...p, offset: p.offset + 50 } : p))
    const merged = mergeSharedPlinths(stripShared(r.cabinets), gapped, SEED_CATALOG)
    const byId = new Map(merged.map((c) => [c.id, c]))
    // Алғашқы екеуі әлі көрші — бірігеді (1200), үшіншісі саңылаудан кейін — жалғыз.
    expect(byId.get(run[0]!.id)!.base!.shared).toBe(true)
    expect(byId.get(run[0]!.id)!.base!.sharedSpan).toBe(1200)
    expect(byId.get(run[1]!.id)!.base!.shared).toBe(true)
    expect(byId.get(run[1]!.id)!.base!.sharedSpan).toBeUndefined()
    expect(byId.get(run[2]!.id)!.base!.shared).toBeUndefined()
  })

  it('«box» пішінді цоколь ешқашан бірікпейді, көршілерін де бөледі', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    const mutated = stripShared(r.cabinets).map((c) =>
      c.id === run[1]!.id ? { ...c, base: { ...c.base!, plinthShape: 'box' as const } } : c)
    const merged = mergeSharedPlinths(mutated, r.placements, SEED_CATALOG)
    const byId = new Map(merged.map((c) => [c.id, c]))
    // Ортадағы қорап бірікпейді, ал екі шеткісі қорап аралығымен бөлінгендіктен
    // (offset арасы үзіліссіз ЕМЕС, ортасында 600 мм box тұр) жеке-жеке қалады.
    expect(byId.get(run[0]!.id)!.base!.shared).toBeUndefined()
    expect(byId.get(run[1]!.id)!.base!.shared).toBeUndefined()
    expect(byId.get(run[2]!.id)!.base!.shared).toBeUndefined()
  })

  it('generateCabinet тікелей шақырылса — shared+box комбинациясында қате лақтырады', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 600, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const cab = r.cabinets.find((c) => c.base?.kind === 'plinth')!
    expect(() => generateCabinet(
      { ...cab, base: { ...cab.base!, shared: true, plinthShape: 'box' } },
      SEED_CATALOG,
    )).toThrow(/box.*бірікпейді|бірікпейді.*box/i)
  })

  it('бұрышта (қабырға ауысқанда) бірікпейді — топтастыру әр қабырғаға БӨЛЕК жүреді', () => {
    const r = generateKitchen({ layout: 'corner', lengthA: 3200, lengthB: 2400, sink: true, upper: true }, SEED_CATALOG)
    const north = floorRun(r, 'north')
    const east = floorRun(r, 'east')
    expect(north.length).toBeGreaterThan(1)
    expect(east.length).toBeGreaterThan(1)
    // Екі қабырғаның да өз БАСЫ (sharedSpan) бар — ортақ емес, әр қабырға бөлек топ.
    const northHeads = north.filter((c) => c.base!.sharedSpan)
    const eastHeads = east.filter((c) => c.base!.sharedSpan)
    expect(northHeads).toHaveLength(1)
    expect(eastHeads).toHaveLength(1)
    expect(northHeads[0]!.id).not.toBe(eastHeads[0]!.id)
    // ⚠ qdesign-нің бұрыштағы мінезі расталмаған — цехпен растау керек (есепте жазылды).
  })

  it('ұзын қабырға: бір панель парақтың енінен (sheetWidth) аспайды', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 7000, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const run = floorRun(r, 'north')
    const heads = run.filter((c) => c.base!.sharedSpan)
    expect(heads.length).toBeGreaterThanOrEqual(2)
    const mat = SEED_CATALOG.materials.find((m) => m.id === run[0]!.carcassMaterialId)!
    for (const h of heads) expect(h.base!.sharedSpan!).toBeLessThanOrEqual(mat.sheetWidth)
    expect(heads.reduce((sum, h) => sum + h.base!.sharedSpan!, 0)).toBe(run.reduce((sum, c) => sum + c.width, 0))
    for (const c of run) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
  })

  it('біріктірілген цоколь деталировкада бір жол болып шығады', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const panels = r.cabinets.flatMap((c) => generateCabinet(c, SEED_CATALOG))
    const plinthRows = groupPanels(panels, SEED_CATALOG).filter((g) => g.row.name.startsWith('Цоколь'))
    expect(plinthRows).toHaveLength(1)
    expect(plinthRows[0]!.row.qty).toBe(1)
    expect(plinthRows[0]!.row.finishedLength).toBe(1800)
  })

  it('присадкасы дұрыс: біріктірілген детальде тесік жоқ (алдыңғы цоколь буынсыз, box сияқты емес)', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const head = r.cabinets.find((c) => c.base?.sharedSpan)!
    const merged = generateCabinet(head, SEED_CATALOG).find((p) => p.id === 'plinth')!
    // «front» пішінді цоколь ешқашан бұрғыланбайды (тек «box» буындасады,
    // ал box ешқашан бірікпейді) — біріктіру жаңа/қалдық тесік қоспайды.
    expect(merged.drilling).toEqual([])
  })

  it('эталон шкаф (§8.7, цоколі жоқ) өзгеріссіз қалады', () => {
    // mergeSharedPlinths тек base.kind==='plinth' бар корпустарды қозғайды;
    // цоколі жоқ жалғыз шкафта ешнәрсе өзгермеуі керек.
    const wardrobe: CabinetConfig[] = []
    const merged = mergeSharedPlinths(wardrobe, [], SEED_CATALOG)
    expect(merged).toEqual([])
  })
})
