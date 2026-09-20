/**
 * Ілгек жүйелері мен тұтқалар.
 *
 * Ең маңызды талап: БРЕНД ПРИСАДКАНЫ ӨЗГЕРТЕДІ. Егер чашканың жиектен
 * қашықтығы жүйеден алынбай, кодтағы тұрақты санмен қалса, бір брендке
 * бұрғыланған фасад екіншісіне бұрылмайды — ал мұны көзбен байқау мүмкін
 * емес, тек станокта шығады.
 */
import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError,
  DEFAULT_HANDLE_ID,
  HANDLE_BORE_SPACINGS,
  HINGE_BRANDS,
  catalogOf,
  countHardware,
  defaultHandleSpec,
  defaultHandles,
  defaultHingeSystems,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  handleBorePoints,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Catalog, HandleModel, HandleSpec, Panel } from '../src/core/index'

const shop = defaultShopProfile()
const fullCatalog = catalogOf(shop)
/** Фурнитурасыз каталог — ескі шақырулар осылай жүреді. */
const bareCatalog: Catalog = { materials: shop.materials, edgeBands: shop.edgeBands }

const template = findTemplate('wardrobe-penal-600')!
const baseCabinet = templateToCabinet(template, fullCatalog)

const bar = defaultHandles().find((h) => h.id === 'handle-bar')!
const knob = defaultHandles().find((h) => h.id === 'handle-knob')!
const profile = defaultHandles().find((h) => h.id === 'handle-profile')!

const spec = (patch: Partial<HandleSpec> = {}): HandleSpec => ({ ...defaultHandleSpec(), ...patch })

const fronts = (panels: Panel[]): Panel[] => panels.filter((p) => p.role === 'front')
const holes = (p: Panel, purpose: string) => p.drilling.filter((d) => d.purpose === purpose)

/** Кабинетті фасад баптауымен қайта құру. */
function withFronts(patch: Record<string, unknown>): CabinetConfig {
  return {
    ...baseCabinet,
    sections: baseCabinet.sections.map((s) => ({
      ...s,
      fronts: s.fronts ? { ...s.fronts, ...patch } : s.fronts,
    })),
  }
}

// ── Тұтқаның геометриясы ─────────────────────────────────────────────────────

describe('тұтқа тесіктерінің орны', () => {
  it('скоба жоғарыда: екі тесік фасад ортасына симметриялы', () => {
    const pts = handleBorePoints(bar, spec({ position: 'top', boreSpacing: 128, edgeOffset: 35 }), 1000, 400)
    expect(pts).toHaveLength(2)
    // Екеуі де жоғарғы жиектен 35 мм.
    expect(pts.map((p) => p.along)).toEqual([965, 965])
    // Ені бойынша ортадан ±64.
    expect(pts.map((p) => p.across)).toEqual([136, 264])
  })

  it('кнопкаға БІР тесік', () => {
    const pts = handleBorePoints(knob, spec({ position: 'top' }), 1000, 400)
    expect(pts).toHaveLength(1)
    expect(pts[0]!.across).toBe(200)
  })

  it('профиль-ручка мен push-to-open тесік ҚАЛДЫРМАЙДЫ', () => {
    expect(handleBorePoints(profile, spec(), 1000, 400)).toHaveLength(0)
    const none = defaultHandles().find((h) => h.id === 'handle-none')!
    expect(handleBorePoints(none, spec(), 1000, 400)).toHaveLength(0)
  })

  it('тік тұтқа: бір бағанда, биіктік ортасында', () => {
    const pts = handleBorePoints(bar, spec({ position: 'right', boreSpacing: 160, edgeOffset: 40 }), 1200, 500)
    expect(pts).toHaveLength(2)
    // Оң жиектен 40 мм — екеуі де бір бағанда.
    expect(pts.map((p) => p.across)).toEqual([460, 460])
    expect(pts.map((p) => p.along)).toEqual([520, 680])
  })

  it('бұрыштық орналасу торцтен endOffset арқылы саналады', () => {
    const left = handleBorePoints(
      bar, spec({ position: 'topLeft', boreSpacing: 128, edgeOffset: 35, endOffset: 100 }), 1000, 600,
    )
    expect(left.map((p) => p.across)).toEqual([36, 164])

    const right = handleBorePoints(
      bar, spec({ position: 'topRight', boreSpacing: 128, edgeOffset: 35, endOffset: 100 }), 1000, 600,
    )
    expect(right.map((p) => p.across)).toEqual([436, 564])
  })

  it('фасадтан кең тұтқа берілсе — ConfigValidationError (§10, audit O10)', () => {
    // Audit O10: бұрын мұнда тесік жиекке ҮНСІЗ ҚЫСЫЛАТЫН (clamp). Ескі тест
    // осы қысу мінезін тексеретін ("тесікті СЫРТҚА шығармайды"), яғни ескірген
    // күтілім болатын — CLAUDE.md §10 «сыймаса — валидация қатесі, үнсіз қысу
    // емес» дегенге тікелей қайшы келеді. Дұрысы: 1024 мм тұтқа 300 мм фасатта
    // сыймайды, сондықтан ConfigValidationError лақтырылуы керек.
    expect(() => handleBorePoints(bar, spec({ position: 'top', boreSpacing: 1024 }), 800, 300))
      .toThrow(ConfigValidationError)
    expect(() => handleBorePoints(bar, spec({ position: 'top', boreSpacing: 1024 }), 800, 300))
      .toThrow(/boreSpacing/)
  })

  it('§O10: 295 мм фасатқа 320 мм межцентрлік тұтқа — тесік жиекке жабыспайды, қате шығады', () => {
    // Аудиттегі нақты мысал: drilling-2026-09-20.md §O10.
    // `handleBorePoints(..., 1994, 295)` бұрын [{along:50, across:0}, {along:50, across:295}]
    // қайтаратын — Ø5 тесік дәл фасадтың жиегінде. Енді валидация керек.
    let error: unknown
    try {
      handleBorePoints(bar, spec({ position: 'top', boreSpacing: 320, edgeOffset: 35 }), 1994, 295)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ConfigValidationError)
    const err = error as InstanceType<typeof ConfigValidationError>
    // §10: қате өрісі мен рұқсат етілген аралық көрсетілуі керек.
    expect(err.field).toMatch(/boreSpacing/)
    expect(err.allowed).toBeDefined()
    expect(err.message).toMatch(/0\.\.295/)
  })

  it('каталогтағы аралықтар 32 мм жүйесінің еселігі', () => {
    for (const s of HANDLE_BORE_SPACINGS) expect(s % 32).toBe(0)
  })
})

// ── Ілгектің бренді присадкаға әсер етеді ────────────────────────────────────

describe('ілгек жүйесі присадкаға түседі', () => {
  it('чашканың орны жүйенің cupFromEdge-інен алынады', () => {
    const systems = defaultHingeSystems()
    const blum = systems.find((s) => s.id === 'hinge-blum-soft-cross-overlay')!
    // Дәл сол жүйе, тек K өлшемі басқа цехтың шаблоны бойынша.
    const custom = { ...blum, id: 'hinge-custom', cupFromEdge: 21, hardwareId: 'hinge-custom' }

    const cabinet = withFronts({ hingeSystemId: 'hinge-custom', handle: null })
    const a = generateCabinet(cabinet, { ...fullCatalog, hingeSystems: [custom] })
    const b = generateCabinet(
      withFronts({ hingeSystemId: blum.id, handle: null }),
      { ...fullCatalog, hingeSystems: [blum] },
    )

    const cupA = holes(fronts(a)[0]!, 'hinge').filter((d) => d.diameter === 35)
    const cupB = holes(fronts(b)[0]!, 'hinge').filter((d) => d.diameter === 35)
    expect(cupA.length).toBeGreaterThan(0)
    expect(cupA.length).toBe(cupB.length)
    // 1 мм айырма — дәл cupFromEdge айырмасы.
    expect(cupB[0]!.y - cupA[0]!.y).toBe(1)
  })

  it('чашка мен планка ілгектің ӨЗ позициясын алып жүреді', () => {
    const panels = generateCabinet(withFronts({ handle: null }), fullCatalog)
    const cup = fronts(panels).flatMap((p) => holes(p, 'hinge')).find((d) => d.diameter === 35)!
    expect(cup.hardwareId).toBe('hinge-blum-soft')

    const plate = panels
      .filter((p) => p.role === 'side')
      .flatMap((p) => holes(p, 'hinge'))
      .find((d) => d.diameter === 5)
    expect(plate?.hardwareId).toBe('hinge-plate')
  })

  it('белгісіз жүйе ҮНСІЗ ауыстырылмайды — қате лақтырылады', () => {
    expect(() => generateCabinet(withFronts({ hingeSystemId: 'жоқ-жүйе' }), fullCatalog)).toThrow(/жүйе табылмады/)
  })

  it('әр бренд каталогта екі жабылу түрімен тұр', () => {
    const systems = defaultHingeSystems()
    for (const brand of HINGE_BRANDS) {
      const mine = systems.filter((s) => s.brand === brand)
      expect(mine.map((s) => s.closing).sort(), brand).toEqual(['none', 'soft'])
    }
  })
})

// ── Генерациямен байланысы ───────────────────────────────────────────────────

describe('фасадтағы тұтқа', () => {
  it('әдепкіде әр фасадта тұтқа бар, тесігі ӨТПЕЛІ', () => {
    const panels = generateCabinet(baseCabinet, fullCatalog)
    const f = fronts(panels)
    expect(f.length).toBeGreaterThan(0)
    for (const p of f) {
      const hh = holes(p, 'handle')
      expect(hh.length, p.label).toBe(2)
      // Өтпелі: тереңдігі панельдің қалыңдығына тең, беті сыртқы.
      for (const d of hh) {
        expect(d.face).toBe('outer')
        expect(d.hardwareId).toBe('handle-bar')
      }
    }
  })

  it('handle: null — тұтқа әдейі жоқ, тесік те жоқ', () => {
    const panels = generateCabinet(withFronts({ handle: null }), fullCatalog)
    for (const p of fronts(panels)) expect(holes(p, 'handle')).toHaveLength(0)
  })

  it('фурнитурасыз каталогта тұтқа да, бренд те қосылмайды', () => {
    // Ескі шақырулар (CLI, тест) осылай жүреді — нәтиже бұрынғыдай қалуы керек.
    const panels = generateCabinet(baseCabinet, bareCatalog)
    for (const p of fronts(panels)) {
      expect(holes(p, 'handle')).toHaveLength(0)
      expect(holes(p, 'hinge').length).toBeGreaterThan(0)
    }
  })

  it('кнопка таңдалса фасадта БІР тесік', () => {
    const panels = generateCabinet(
      withFronts({ handle: spec({ handleId: 'handle-knob' }) }), fullCatalog,
    )
    for (const p of fronts(panels)) expect(holes(p, 'handle')).toHaveLength(1)
  })
})

// ── Сметамен байланысы ───────────────────────────────────────────────────────

describe('фурнитура сметаға дұрыс түседі', () => {
  it('фасад САНЫ бойынша тұтқа саналады, тесік саны бойынша емес', () => {
    const panels = generateCabinet(baseCabinet, fullCatalog)
    const counts = countHardware(panels)
    // Скобада фасадқа 2 тесік, бірақ тұтқа біреу.
    expect(counts.get('handle-bar')).toBe(fronts(panels).length)
  })

  it('ілгек өз брендінің жолына түседі, әр ілгекке бір планка', () => {
    const panels = generateCabinet(withFronts({ handle: null }), fullCatalog)
    const counts = countHardware(panels)
    const cups = fronts(panels).flatMap((p) => holes(p, 'hinge')).filter((d) => d.diameter === 35).length
    expect(counts.get('hinge-blum-soft')).toBe(cups)
    expect(counts.get('hinge-plate')).toBe(cups)
    // Ескі жалпы позиция ЕНДІ ҚОЛДАНЫЛМАЙДЫ.
    expect(counts.get('hinge-overlay')).toBeUndefined()
  })

  it('екі түрлі бренд бір жобада БӨЛЕК жолда тұрады', () => {
    const systems = defaultHingeSystems()
    const blum = systems.find((s) => s.id === 'hinge-blum-soft-cross-overlay')!
    const boyard = systems.find((s) => s.id === 'hinge-boyard-none-cross-overlay')!

    const a = generateCabinet(withFronts({ hingeSystemId: blum.id, handle: null }), fullCatalog)
    const b = generateCabinet(withFronts({ hingeSystemId: boyard.id, handle: null }), fullCatalog)
    const counts = countHardware([...a, ...b])

    expect(counts.get('hinge-blum-soft')).toBeGreaterThan(0)
    expect(counts.get('hinge-boyard-none')).toBeGreaterThan(0)
    expect(counts.get('hinge-blum-soft')).toBe(counts.get('hinge-boyard-none'))
  })

  it('каталогтағы әр тұтқа мен ілгектің сметада бағасы қоятын жолы бар', () => {
    const ids = new Set(shop.hardware.map((h) => h.id))
    for (const h of shop.handles) expect(ids.has(h.hardwareId), h.name).toBe(true)
    for (const s of shop.hingeSystems) {
      if (s.arm === 'cross' && s.mount === 'overlay') expect(ids.has(s.hardwareId), s.name).toBe(true)
    }
  })
})

// ── Әдепкі мәндер ────────────────────────────────────────────────────────────

describe('әдепкі баптау', () => {
  it('әдепкі тұтқа каталогта бар', () => {
    const model: HandleModel | undefined = defaultHandles().find((h) => h.id === DEFAULT_HANDLE_ID)
    expect(model).toBeDefined()
    expect(model!.boreSpacings).toContain(defaultHandleSpec().boreSpacing)
  })
})
