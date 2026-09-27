/**
 * K10 / audit C8 (docs/audit/corner-2026-09-20.md §C8,
 * docs/audit/drilling-fix-plan.md К10): бұрыштық (трапеция) корпуста
 * трапецияны БІЛМЕЙТІН детальдар — аяқ, столешница, планка, стойка,
 * цоколь-короб, фронтальдық панель.
 *
 * Тіркесім қазіргі генераторда (kitchen.ts) МҮЛДЕ қолданылмайды: `corner`
 * өрісі тек осы тесттер мен Configurator.tsx-тің қолмен түзетілетін
 * «Угловой (переходной)» тумблерінде ғана орнатылады.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf, defaultShopProfile, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** corner.test.ts-тегімен бірдей: ашық переходной модуль. */
const corner = (depthAtRight: number, patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...template,
  depth: 600,
  back: { mode: 'none' },
  corner: { depthAtRight },
  sections: [{
    ...template.sections[0]!,
    fronts: null,
    contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
  }],
  ...patch,
})

const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === id)!

// ── K10a: аяқ — ЕҢ ҚАУІПТІ, тесігі ауада ───────────────────────────────────

describe('K10a: аяқ (legs) + бұрыштық корпус — қате', () => {
  /**
   * Нақты генерациямен тексерілді (түзетуге дейін): `corner(350)` +
   * `base.kind: 'legs'` кезінде дноның 16 тесігінің 4-уі (алдыңғы-оң аяқтың
   * бұрандалары, x≈464..529, y≈70..135) МАТЕРИАЛСЫЗ аймаққа түседі — сол
   * жерде трапецияның материал шегі y ≥ ~218 мм-ден басталады. Дұрыс орынды
   * қайда жылжыту керегі (қанша шегіну, асимметриялы аяқ санын рұқсат ету
   * керек пе) — цехтың шешімі, сондықтан кодтан ойдан шығармай қате
   * лақтырамыз (§10, drilling-fix-plan.md «B тобы»).
   */
  it('дноның бұрандасы ауада тұрмас үшін: legs + corner тыйым салынған', () => {
    const cfg = corner(350, { base: { kind: 'legs', height: 95 } })
    expect(() => generateCabinet(cfg, catalog)).toThrow(/legs|аяқ/)
  })

  it('цоколь (plinth, front) режимі — ӘСЕР ЕТПЕЙДІ, бұрынғыдай жұмыс істейді', () => {
    // Тек «front» пішінді цоколь трапецияға тәуелсіз: ол тек алдыңғы жиекте
    // тұрған жалпақ тақта, тереңдікке кірмейді.
    const cfg = corner(350, { base: { kind: 'plinth', height: 95 } })
    const panels = generateCabinet(cfg, catalog)
    expect(byId(panels, 'plinth')).toBeDefined()
  })
})

// ── K10b: цоколь-короб — оң жақ қиғаштың алдынан шығып тұр ─────────────────

describe('K10b: цоколь-КОРОБ (plinthShape box) + бұрыштық корпус — қате', () => {
  /**
   * Нақты сан (600/350): `plinth-right` (боковой) тақтайы `boxDepth = D −
   * plinthSetback − 2·pt`-мен есептеледі — номиналды D (=600), сол жақтың
   * тереңдігі. Оң жақта нақты тереңдік 350, яғни тақтай ~184 мм шығып тұрады.
   */
  it('box пішіні тыйым салынған', () => {
    const cfg = corner(350, { base: { kind: 'plinth', height: 95, plinthShape: 'box' as const } })
    expect(() => generateCabinet(cfg, catalog)).toThrow(/plinth|цоколь|короб/)
  })
})

// ── K10c: столешница (жеке, ортақ емес) — қиғашты білмейді ─────────────────

describe('K10c: столешница (worktop, ортақ емес) + бұрыштық корпус — қате', () => {
  it('тыйым салынған', () => {
    const cfg = corner(350, { worktop: { overhangFront: 20, overhangSides: 20 } })
    expect(() => generateCabinet(cfg, catalog)).toThrow(/worktop|столешниц/)
  })

  it('ОРТАҚ (shared: true) столешница — ӘСЕР ЕТПЕЙДІ, ол мүлде жасалмайды', () => {
    // shared:true болғанда generateCabinet worktop панелін мүлде шығармайды
    // (кросс-кабинет worktopParts бөлек есептейді) — сондықтан бұрыштық
    // корпуспен ешбір қайшылық жоқ.
    const cfg = corner(350, { worktop: { overhangFront: 20, overhangSides: 20, shared: true } })
    expect(() => generateCabinet(cfg, catalog)).not.toThrow()
  })
})

// ── K10d: планка (topRails) — қиғаш зонада материалы жоқ жерге тұр ─────────

describe('K10d: планка (topRails) + бұрыштық корпус — қате', () => {
  /**
   * Нақты сан (600/350): рейл z=0..100 терезесінде тұрады, ал қиғаш
   * аймақта (х оң шетке жақын) материалдың шегі ~250 мм-ден басталады —
   * рейлдің астында МАТЕРИАЛ МҮЛДЕ ЖОҚ, тек «ұзын шеті ілінеді» емес.
   */
  it('тыйым салынған', () => {
    const cfg = corner(350, { topRails: { count: 2, width: 100, orientation: 'flat' as const } })
    expect(() => generateCabinet(cfg, catalog)).toThrow(/topRails|планка/)
  })
})

// ── K10e: фронтальдық панель — корпустың нақты алды артта қалып, панель ауада ілінеді

describe('K10e: фронтальдық панель (frontPanel) + бұрыштық корпус — қате', () => {
  /**
   * Нақты сан (600/350, side='right', width=200): панель z=-16..0-де,
   * ал сол жерде (х=400..600) корпустың нақты алды z≈167..250 — панель
   * мен корпустың арасында сырт ауа, панель ешнәрсеге ілінбейді.
   */
  it('тыйым салынған', () => {
    const cfg = corner(350, { frontPanel: { width: 200, side: 'right' as const } })
    expect(() => generateCabinet(cfg, catalog)).toThrow(/frontPanel|фронтальд/)
  })
})

// ── K10f: стойка (stand) — НАҚТЫ ТҮЗЕТУ: тереңдігі Х нүктесінен есептеледі ─

describe('K10f: стойка (stand) + бұрыштық корпус — Х нүктесінен тереңдік', () => {
  /**
   * Сол жақтағы стойка (х аз) терең жерде тұрады — тереңдігі сол бүйірге
   * жуық (600-ге жақын). Оң жақтағы стойка (х көп) қиғаш жерде тұрады —
   * тереңдігі 350-ге жуық. Түзетуге дейін екеуі БІРДЕЙ болатын (тереңдік
   * Х-тен тәуелсіз, slope-тың орта нүктесінен ғана есептелетін).
   */
  it('сол жақ стойка терең, оң жақ стойка тайыз — екеуі ӘРТҮРЛІ', () => {
    const cfg = corner(350, {
      sections: [{
        ...template.sections[0]!,
        fronts: null,
        contents: [{ kind: 'stand', count: 2, at: [20, 500] }],
      }],
    })
    const panels = generateCabinet(cfg, catalog)
    const stands = panels.filter((p) => p.role === 'divider').sort((a, b) => a.position.x - b.position.x)
    expect(stands).toHaveLength(2)
    const [leftStand, rightStand] = stands
    expect(leftStand!.finishedWidth).toBeGreaterThan(rightStand!.finishedWidth)
    expect(stands.every((stand) => Number.isInteger(stand.finishedWidth) && Number.isInteger(stand.position.z))).toBe(true)
    const t = catalog.materials.find((material) => material.id === cfg.carcassMaterialId)!.thickness
    for (const stand of stands) {
      // Оң шеттегі трапеция алды: стойка соның ішіне толық сыйсын.
      expect(stand.position.z).toBeGreaterThanOrEqual(
        (cfg.depth - cfg.corner!.depthAtRight) * stand.position.x / (cfg.width - 2 * t),
      )
    }
    // Сол жақ х=20 — корпустың сол шетіне жақын, тереңдігі толық сол
    // бүйірдің тереңдігіне (600) жуық болуы керек.
    expect(leftStand!.finishedWidth).toBeGreaterThan(560)
    // Оң жақ х=500 — қиғаш аяқталар алдында, тереңдігі 350-ге жуық.
    expect(rightStand!.finishedWidth).toBeLessThan(400)
  })

  it('стойка МАТЕРИАЛДЫҢ ІШІНДЕ тұрады: z + тереңдік әрқашан бүйірдің тереңдігінен аспайды', () => {
    const cfg = corner(350, {
      sections: [{
        ...template.sections[0]!,
        fronts: null,
        contents: [{ kind: 'stand', count: 3 }],
      }],
    })
    const panels = generateCabinet(cfg, catalog)
    const stands = panels.filter((p) => p.role === 'divider')
    expect(stands.length).toBe(3)
    for (const s of stands) {
      // Артқы жиегі әрқашан 600-ден аспауы керек (қабырғаға тіреледі, одан әрі емес).
      expect(s.position.z + s.finishedWidth).toBeLessThanOrEqual(600)
      // Алдыңғы жиегі теріс болмауы керек.
      expect(s.position.z).toBeGreaterThanOrEqual(0)
    }
  })
})
