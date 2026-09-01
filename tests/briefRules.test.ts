/**
 * Техзадание — ИНТЕРНЕТСІЗ.
 *
 * Басты уәде: пайдаланушыға көрінген вариант ӘРҚАШАН жиналады. Сондықтан
 * әр тестте вариант шынымен `generateCabinet`-тен өтеді — «сурет дұрыс па»
 * емес, «цех оны кесе ала ма» деген сұрақ тексеріледі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  SEED_TEMPLATES,
  defaultSizeOf,
  generateCabinet,
  parseBriefRequest,
  ruleVariants,
} from '../src/core/index'
import type { BriefRequest } from '../src/core/index'

const request = (over: Partial<BriefRequest> = {}): BriefRequest => ({
  kind: 'wardrobe',
  height: 2200,
  width: 1800,
  depth: 600,
  hanging: true,
  drawers: 0,
  doors: true,
  sliding: false,
  ...over,
})

describe('мәтінді оқу', () => {
  it('жиһаздың түрін таниды — орысша да, қазақша да', () => {
    expect(parseBriefRequest('нужен шкаф в прихожую').kind).toBe('wardrobe')
    expect(parseBriefRequest('кухня 3 метра').kind).toBe('kitchen')
    expect(parseBriefRequest('рабочий стол для сына').kind).toBe('desk')
    expect(parseBriefRequest('ас үй жиһазы керек').kind).toBe('kitchen')
    expect(parseBriefRequest('киім шкафы, ілгіш керек').kind).toBe('wardrobe')
    expect(parseBriefRequest('стеллаж под книги').kind).toBe('storage')
  })

  it('габаритті үш санмен де, сөзбен де алады (H × W × D)', () => {
    expect(parseBriefRequest('шкаф 2400x1600x600')).toMatchObject({
      height: 2400, width: 1600, depth: 600,
    })
    expect(parseBriefRequest('шкаф высотой 2100, ширина 1200, глубина 450')).toMatchObject({
      height: 2100, width: 1200, depth: 450,
    })
    expect(parseBriefRequest('шкаф биіктігі 2000, ені 900')).toMatchObject({
      height: 2000, width: 900,
    })
  })

  it('сан айтылмаса — түрдің әдеттегі габариті', () => {
    const parsed = parseBriefRequest('нужен кухонный шкаф')
    expect(parsed).toMatchObject(defaultSizeOf('kitchen'))
  })

  it('ящик санын алады, айтылмаса 0', () => {
    expect(parseBriefRequest('шкаф с 4 ящиками').drawers).toBe(4)
    expect(parseBriefRequest('шкаф, ящиков 2').drawers).toBe(2)
    expect(parseBriefRequest('3 суырма керек').drawers).toBe(3)
    expect(parseBriefRequest('шкаф с ящиками').drawers).toBe(3)
    expect(parseBriefRequest('обычный шкаф').drawers).toBe(0)
  })

  it('«открытый» дегенді есіктің ЖОҚТЫҒЫ деп оқиды', () => {
    expect(parseBriefRequest('открытый стеллаж').doors).toBe(false)
    expect(parseBriefRequest('шкаф без дверей').doors).toBe(false)
    expect(parseBriefRequest('ашық сөрелер').doors).toBe(false)
    expect(parseBriefRequest('шкаф с дверьми').doors).toBe(true)
  })

  it('купе есігі айтылса, есік те бар деп саналады', () => {
    const parsed = parseBriefRequest('шкаф-купе 2400x1800x600')
    expect(parsed.sliding).toBe(true)
    expect(parsed.doors).toBe(true)
  })

  it('бос мәтін де ЖАРАМДЫ өтінім береді', () => {
    const parsed = parseBriefRequest('')
    expect(parsed.height).toBeGreaterThan(0)
    expect(ruleVariants(parsed, SEED_CATALOG).length).toBeGreaterThan(0)
  })
})

describe('варианттар', () => {
  it('үшеу шығады әрі бәрі ЖИНАЛАДЫ', () => {
    const variants = ruleVariants(request(), SEED_CATALOG)
    expect(variants).toHaveLength(3)
    for (const v of variants) {
      expect(() => generateCabinet(v.cabinet, SEED_CATALOG)).not.toThrow()
      expect(generateCabinet(v.cabinet, SEED_CATALOG).length).toBeGreaterThan(3)
    }
  })

  it('варианттар бір-бірінен ӨЗГЕШЕ', () => {
    const variants = ruleVariants(request(), SEED_CATALOG)
    expect(new Set(variants.map((v) => v.templateId)).size).toBe(variants.length)
  })

  it('сұралған түрдің шаблондарынан ғана таңдалады', () => {
    for (const kind of ['kitchen', 'desk', 'bed', 'storage'] as const) {
      const variants = ruleVariants(request({ kind }), SEED_CATALOG)
      expect(variants.length).toBeGreaterThan(0)
      for (const v of variants) {
        expect(SEED_TEMPLATES.find((t) => t.id === v.templateId)!.category, kind).toBe(kind)
      }
    }
  })

  it('габарит шаблонның аралығына қысылады, шектен АСПАЙДЫ', () => {
    const variants = ruleVariants(request({ height: 3900, width: 3800, depth: 900 }), SEED_CATALOG)
    for (const v of variants) {
      const template = SEED_TEMPLATES.find((t) => t.id === v.templateId)!
      expect(v.cabinet.height).toBeLessThanOrEqual(template.range.height.max)
      expect(v.cabinet.width).toBeLessThanOrEqual(template.range.width.max)
      expect(v.cabinet.depth).toBeLessThanOrEqual(template.range.depth.max)
      expect(() => generateCabinet(v.cabinet, SEED_CATALOG)).not.toThrow()
    }
  })

  it('ящик сұралса, ол бірінші секцияның ТӨМЕНІНДЕ пайда болады', () => {
    const variants = ruleVariants(request({ drawers: 3 }), SEED_CATALOG)
    for (const v of variants) {
      const first = v.cabinet.sections[0]!
      expect(first.contents[0]).toMatchObject({ kind: 'drawers' })
      const panels = generateCabinet(v.cabinet, SEED_CATALOG)
      expect(panels.some((p) => p.role === 'drawerSide')).toBe(true)
    }
  })

  /**
   * «Есіксіз» — СЕКЦИЯНЫҢ есігі жоқ дегені. Ящиктің фасады қалады: фасадсыз
   * ящик — ящик емес. Тест дәл осыны бекітеді, әйтпесе кейін біреу «фасад
   * қалып қойған» деп ящиктің фасадын өшіріп жіберер еді.
   */
  it('«есіксіз» дегенде секцияда фасад болмайды (ящиктің фасады қалады)', () => {
    const variants = ruleVariants(request({ doors: false, sliding: false }), SEED_CATALOG)
    for (const v of variants) {
      expect(v.cabinet.sliding).toBeUndefined()
      expect(v.cabinet.sections.every((s) => s.fronts === null)).toBe(true)
      const fronts = generateCabinet(v.cabinet, SEED_CATALOG).filter((p) => p.role === 'front')
      for (const front of fronts) expect(front.id).toContain('drawer')
    }
  })

  it('купе сұралса, ілмелі фасад ҚАТАР тұрмайды', () => {
    const variants = ruleVariants(request({ sliding: true }), SEED_CATALOG)
    for (const v of variants) {
      expect(v.cabinet.sliding).toBeDefined()
      expect(v.cabinet.sections.every((s) => s.fronts === null)).toBe(true)
      expect(() => generateCabinet(v.cabinet, SEED_CATALOG)).not.toThrow()
    }
  })

  it('штанга сұралса, ол шынымен пайда болады', () => {
    const variants = ruleVariants(request({ hanging: true }), SEED_CATALOG)
    for (const v of variants) {
      const contents = v.cabinet.sections.flatMap((s) => s.contents)
      expect(contents.some((c) => c.kind === 'rod')).toBe(true)
    }
  })

  it('түсіндірмесі бос емес әрі габаритті атайды', () => {
    const [first] = ruleVariants(request(), SEED_CATALOG)
    expect(first!.rationale).toContain('2200')
    expect(first!.name.length).toBeGreaterThan(0)
  })

  it('нәтиже ТҰРАҚТЫ: бірдей өтінім — бірдей варианттар', () => {
    expect(ruleVariants(request(), SEED_CATALOG)).toEqual(ruleVariants(request(), SEED_CATALOG))
  })

  it('мәтіннен нәтижеге дейінгі жол тұтас жүреді', () => {
    const variants = ruleVariants(parseBriefRequest('шкаф-купе 2400x1800x600 со штангой и 3 ящиками'), SEED_CATALOG)
    expect(variants.length).toBeGreaterThan(0)
    const [first] = variants
    expect(first!.cabinet.sliding).toBeDefined()
    expect(first!.cabinet.sections.flatMap((s) => s.contents).some((c) => c.kind === 'drawers')).toBe(true)
    expect(() => generateCabinet(first!.cabinet, SEED_CATALOG)).not.toThrow()
  })
})
