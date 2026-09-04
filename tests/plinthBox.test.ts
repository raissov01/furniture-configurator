/**
 * Цокольдің ЖАБЫҚ ҚОРАБЫ (qdesign: «накладной короб»).
 *
 * Сандар ойдан алынған ЖОҚ: бәсекелестің дәл сол өлшемдегі модулінен
 * өлшенді (2026-09-04, 900 × 1540 × 700, цоколь 95, шегініс 30):
 *   алды  900 × 95      — толық ені
 *   арты  900 × 95      — толық ені, корпустың арт жиегімен тегіс
 *   бүйір 638 × 95 × 2  — 700 − 30 − 2×16, екеуінің АРАСЫНА кіреді
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, countHardware, generateCabinet } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const BASE_HEIGHT = 95
const base = { kind: 'plinth' as const, height: BASE_HEIGHT }
const t = 16

const build = (shape?: 'front' | 'box') =>
  generateCabinet(withCabinet({
    width: 900, height: 1540, depth: 700,
    base: shape ? { ...base, plinthShape: shape } : base,
  }), catalog)

const plinths = (panels: ReturnType<typeof build>) => panels.filter((p) => p.role === 'plinth')

describe('цокольдің пішіні', () => {
  it('әдепкіде — тек АЛДЫҢҒЫ планка (ескі мінез өзгермеген)', () => {
    const only = plinths(build())
    expect(only).toHaveLength(1)
    expect(only[0]!.id).toBe('plinth')
    expect(only[0]!.finishedLength).toBe(900)
    expect(only[0]!.finishedWidth).toBe(BASE_HEIGHT)
  })

  it('«front» деп ашық жазу да сол нәтижені береді', () => {
    expect(plinths(build('front'))).toHaveLength(1)
  })

  it('«box» төрт деталь береді: алды, арты, екі бүйір', () => {
    const parts = plinths(build('box'))
    expect(parts.map((p) => p.id).sort()).toEqual(
      ['plinth', 'plinth-back', 'plinth-left', 'plinth-right'],
    )
  })

  it('алды мен арты — ТОЛЫҚ ені, бүйірлер олардың АРАСЫНА кіреді', () => {
    const parts = plinths(build('box'))
    const byId = new Map(parts.map((p) => [p.id, p]))

    expect(byId.get('plinth')!.finishedLength).toBe(900)
    expect(byId.get('plinth-back')!.finishedLength).toBe(900)

    const side = byId.get('plinth-left')!
    expect(side.finishedWidth).toBe(700 - DEFAULT_SETTINGS.plinthSetback - 2 * t)
    expect(side.finishedLength).toBe(BASE_HEIGHT)
  })

  it('БӘСЕКЕЛЕСТЕН ӨЛШЕНГЕН САН: шегініс 30 болғанда бүйір дәл 638 шығады', () => {
    // qdesign, 2026-09-04: модуль 900 × 1540 × 700, цоколь 95, шығыңқы 30.
    // Ондағы бүйір тақтай 16 × 95 × 638 еді. Бізде әдепкі шегініс 50,
    // сондықтан салыстыру үшін цехтың санын солардікіне теңестіреміз.
    const parts = generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 700,
      base: { ...base, plinthShape: 'box' },
      settings: { plinthSetback: 30 },
    }), catalog).filter((p) => p.role === 'plinth')
    const side = parts.find((p) => p.id === 'plinth-left')!
    expect(side.finishedWidth).toBe(638)
    expect(side.finishedLength).toBe(95)
    expect(parts.find((p) => p.id === 'plinth-back')!.finishedLength).toBe(900)
  })

  it('бүйірлер корпустың бүйірімен беттеседі, шегініс тек АЛДЫНДА', () => {
    const byId = new Map(plinths(build('box')).map((p) => [p.id, p]))
    expect(byId.get('plinth-left')!.position.x).toBe(0)
    expect(byId.get('plinth-right')!.position.x).toBe(900 - t)
    // Алдыңғы планка шегіндірілген, ал арт тақтай арт жиекте тұр.
    expect(byId.get('plinth')!.position.z).toBe(DEFAULT_SETTINGS.plinthSetback)
    expect(byId.get('plinth-back')!.position.z).toBe(700 - t)
    // Бүйірлер алдыңғы планканың АРТЫНАН басталады.
    expect(byId.get('plinth-left')!.position.z).toBe(DEFAULT_SETTINGS.plinthSetback + t)
  })

  it('төртеуі де бір деңгейде, корпустың АСТЫНДА тұр', () => {
    const parts = plinths(build('box'))
    expect(new Set(parts.map((p) => p.position.y))).toEqual(new Set([0]))
  })

  it('АРТ тақтайға кромка жабыспайды: оны ешкім көрмейді', () => {
    const byId = new Map(plinths(build('box')).map((p) => [p.id, p]))
    const back = byId.get('plinth-back')!
    expect(Object.values(back.edges).every((e) => e === null)).toBe(true)
    // Ал алдыңғы планканың көрінетін жиегі кромкаланады.
    expect(byId.get('plinth')!.edges.L1).not.toBeNull()
  })

  it('тереңдігі жетпесе — ҮНСІЗ өтпейді, қате шығады', () => {
    expect(() => generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 140,
      base: { ...base, plinthShape: 'box' },
    }), catalog)).toThrow(/короб/)
  })

  it('цокольдің материалы қорапқа да қолданылады', () => {
    const other = catalog.materials.find((m) => m.id !== 'ldsp16-h1145' && m.thickness === 16)
    if (!other) return
    const parts = plinths(generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 700,
      base: { ...base, plinthShape: 'box', plinthMaterialId: other.id },
    }), catalog))
    expect(parts.every((p) => p.materialId === other.id)).toBe(true)
  })
})

/**
 * Қорапты ЖИНАУ.
 *
 * Бұл жерде «дұрыс жауап» жоқ — екеуі де цехта кездеседі, сондықтан таңдау
 * ашық. Тест таңдаудың САЛДАРЫН күзетеді: конфирматта бұранданың басы
 * көрінетін бетке шығады (заглушка керек), минификсте шықпайды.
 */
describe('цоколь қорабының буындары', () => {
  const boxWith = (joint?: 'confirmat' | 'minifix') =>
    generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 700,
      base: { ...base, plinthShape: 'box', ...(joint ? { plinthJoint: joint } : {}) },
    }), catalog).filter((p) => p.role === 'plinth')

  it('әдепкіде конфирмат: әр бұрышта 2 бұранда, төрт бұрыш', () => {
    const parts = boxWith()
    const byId = new Map(parts.map((p) => [p.id, p]))
    // Алдыңғы тақтай: екі бұрыш × 2 = 4 өтпелі тесік.
    expect(byId.get('plinth')!.drilling.filter((d) => d.purpose === 'confirmat')).toHaveLength(4)
    expect(byId.get('plinth-back')!.drilling).toHaveLength(4)
    // Бүйірдің ЕКІ ұшында да пилот тесік (алдына да, артына да тіреледі).
    const left = byId.get('plinth-left')!
    expect(new Set(left.drilling.map((d) => d.face))).toEqual(new Set(['edgeL1', 'edgeL2']))
    expect(left.drilling).toHaveLength(4)
  })

  it('ҚЫСҚА БУЫН ережесі: тесік жиектен ≥ 24 мм, реті дұрыс', () => {
    const left = boxWith().find((p) => p.id === 'plinth-left')!
    const xs = [...new Set(left.drilling.map((d) => d.x))].sort((a, b) => a - b)
    expect(xs).toEqual([32, 63]) // 95 / 3 = 31.7 → 32, екіншісі 95 − 32
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(24)
      expect(BASE_HEIGHT - x).toBeGreaterThanOrEqual(24)
    }
  })

  it('минификсте көрінетін бетте бұранданың басы ЖОҚ', () => {
    const byId = new Map(boxWith('minifix').map((p) => [p.id, p]))
    const front = byId.get('plinth')!
    expect(front.drilling.some((d) => d.face === 'outer')).toBe(false)
    expect(front.drilling.some((d) => d.purpose === 'minifix')).toBe(true)
    // Бүйірдің бетінде штифт бұралатын тесік тұрады.
    expect(byId.get('plinth-left')!.drilling.some((d) => d.purpose === 'minifix')).toBe(true)
  })

  it('конфирматта деталировка заглушка керегін АЙТАДЫ', () => {
    const front = boxWith().find((p) => p.id === 'plinth')!
    expect(front.note).toMatch(/заглушк/i)
    // Ал жай планкада (қорапсыз) ондай ескертпе жоқ.
    const plain = generateCabinet(withCabinet({ width: 900, height: 1540, depth: 700, base }), catalog)
      .find((p) => p.id === 'plinth')!
    expect(plain.note).not.toMatch(/заглушк/i)
  })
})

/** Ақша: қорап бос шықпауы керек — бұрандасы сметаға түседі. */
describe('цоколь қорабы сметада', () => {
  const buildAll = (extra: object) => generateCabinet(withCabinet({
    width: 900, height: 1540, depth: 700, base: { ...base, ...extra },
  }), catalog)

  it('конфирматтары мен заглушкалары сметаға қосылады', () => {
    const plain = countHardware(buildAll({}))
    const box = countHardware(buildAll({ plinthShape: 'box' }))
    const screws = (m: Map<string, number>) => m.get('confirmat-7x50') ?? 0
    // Төрт бұрыш × 2 бұранда = 8.
    expect(screws(box) - screws(plain)).toBe(8)
    expect(box.get('confirmat-cap')).toBe(box.get('confirmat-7x50'))
  })

  it('минификсте конфирмат емес, стяжка саналады', () => {
    const box = countHardware(buildAll({ plinthShape: 'box', plinthJoint: 'minifix' }))
    const plain = countHardware(buildAll({}))
    expect(box.get('confirmat-7x50') ?? 0).toBe(plain.get('confirmat-7x50') ?? 0)
    expect((box.get('minifix-15') ?? 0) - (plain.get('minifix-15') ?? 0)).toBe(8)
  })
})
