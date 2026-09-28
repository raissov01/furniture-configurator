/**
 * Сұрақ-жауап боты — ережелік өзек (03g §4). Желісіз, детерминді; конфиг бар
 * генераторлардан шығады әрі `generateCabinet`-пен тексеріледі.
 */
import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError, SEED_CATALOG, defaultSizeOf, generateCabinet, qaAiRequest, qaAnswer, qaBuild,
  qaNextQuestion, qaQuestions,
} from '../src/core/index'
import type { QaAnswers, QaQuestionId } from '../src/core/index'

const catalog = SEED_CATALOG

/** Бот сияқты жүреді: әр сұраққа берілген жауап, жоқ болса әдепкі. */
function walk(script: Partial<Record<QaQuestionId, string | number>>): { answers: QaAnswers; asked: QaQuestionId[] } {
  let answers: QaAnswers = {}
  const asked: QaQuestionId[] = []
  for (let q = qaNextQuestion(answers, catalog); q; q = qaNextQuestion(answers, catalog)) {
    asked.push(q.id)
    answers = qaAnswer(answers, q.id, script[q.id] ?? q.default, catalog)
    if (asked.length > 40) throw new Error('ағын аяқталмады')
  }
  return { answers, asked }
}

function fieldOf(run: () => unknown): string {
  try { run() } catch (cause) {
    if (cause instanceof ConfigValidationError) return cause.field
    throw cause
  }
  throw new Error('қате лақтырылмады')
}

describe('сұрақ ағыны', () => {
  it('шкаф: түр → габарит → секция/есік/ящик → материал, ретімен', () => {
    const { asked } = walk({ furniture: 'wardrobe' })
    expect(asked).toEqual([
      'furniture', 'width', 'height', 'depth', 'sections', 'doors', 'doorsPerSection',
      'shelvesPerSection', 'drawers', 'hanging', 'carcassMaterialId', 'frontMaterialId',
    ])
  })

  it('ас үй: секция емес — пішін мен қабырғалар сұралады', () => {
    expect(walk({ furniture: 'kitchen', layout: 'u' }).asked).toEqual([
      'furniture', 'layout', 'lengthA', 'lengthB', 'lengthC', 'upper', 'sink', 'appliances',
      'carcassMaterialId', 'frontMaterialId',
    ])
    expect(walk({ furniture: 'kitchen' }).asked).not.toContain('lengthB')
  })

  it('купе таңдалса — есік саны сұралады, секция басына есік сұралмайды', () => {
    const { asked } = walk({ furniture: 'wardrobe', doors: 'sliding' })
    expect(asked).toContain('slidingCount')
    expect(asked).not.toContain('doorsPerSection')
  })

  it('әдепкі габарит — түрдің шаблонынан, секция саны — енінен', () => {
    const questions = qaQuestions({ furniture: 'wardrobe', width: 2400 }, catalog)
    const size = defaultSizeOf('wardrobe')
    expect(questions.find((q) => q.id === 'height')!.default).toBe(size.height)
    expect(questions.find((q) => q.id === 'sections')!.default).toBe(4)
    const perSection = (width: number, sections: number) => qaQuestions(
      { furniture: 'wardrobe', width, sections, doors: 'hinged' }, catalog).find((q) => q.id === 'doorsPerSection')!.default
    expect(perSection(2400, 2)).toBe(2)
    expect(perSection(2400, 4)).toBe(1)
  })

  it('материал нұсқаларында ХДФ пен тақта жоқ', () => {
    const question = qaQuestions({ furniture: 'wardrobe' }, catalog).find((q) => q.id === 'carcassMaterialId')!
    if (question.kind !== 'choice') throw new Error('choice күтілді')
    const offered = question.options.map((o) => catalog.materials.find((m) => m.id === o.value)!)
    expect(offered.length).toBeGreaterThan(3)
    expect(offered.some((m) => m.id.startsWith('hdf'))).toBe(false)
    expect(offered.every((m) => !m.slab)).toBe(true)
  })

  it('түр ауысса, ескі жауаптар тазаланады', () => {
    const answers = qaAnswer({ furniture: 'wardrobe', width: 2400, sections: 4 }, 'furniture', 'kitchen', catalog)
    expect(answers).toEqual({ furniture: 'kitchen' })
  })

  it('жарамсыз жауап — answers.<id> өрісімен қате', () => {
    expect(fieldOf(() => qaAnswer({}, 'furniture', 'bed', catalog))).toBe('answers.furniture')
    expect(fieldOf(() => qaAnswer({ furniture: 'wardrobe' }, 'width', 50, catalog))).toBe('answers.width')
    expect(fieldOf(() => qaAnswer({ furniture: 'wardrobe' }, 'width', 1200.5, catalog))).toBe('answers.width')
    expect(fieldOf(() => qaAnswer({ furniture: 'wardrobe' }, 'lengthA', 3000, catalog))).toBe('answers.lengthA')
    expect(fieldOf(() => qaBuild({ furniture: 'wardrobe', sections: 99 }, catalog))).toBe('answers.sections')
  })
})

describe('құрастыру — бар генераторлар арқылы', () => {
  it('3 секциялы шкаф, 2 ящик, штанга: жауаптағы габарит пен толтырылым', () => {
    const { answers } = walk({ furniture: 'wardrobe', width: 1800, height: 2200, depth: 600, sections: 3,
      doorsPerSection: 1, drawers: 2, shelvesPerSection: 4, hanging: 'yes' })
    const result = qaBuild(answers, catalog)
    if (result.kind !== 'cabinet') throw new Error('шкаф күтілді')
    const { cabinet } = result
    expect([cabinet.height, cabinet.width, cabinet.depth]).toEqual([2200, 1800, 600])
    expect(cabinet.sections).toHaveLength(3)
    expect(cabinet.sections[0]!.contents[0]).toEqual({ kind: 'drawers', count: 2 })
    expect(cabinet.sections[2]!.contents.map((c) => c.kind)).toEqual(['rod', 'shelves'])
    expect(cabinet.sections[1]!.contents).toEqual([{ kind: 'shelves', count: 4, shelfKind: 'adjustable' }])
    expect(cabinet.sections.every((s) => s.fronts?.count === 1)).toBe(true)
    const panels = generateCabinet(cabinet, catalog)
    expect(panels.filter((p) => p.role === 'front').length).toBeGreaterThanOrEqual(3)
  })

  it('купе шкаф: секция фасадтары жоқ, sliding саны жауаптан', () => {
    const { answers } = walk({ furniture: 'wardrobe', width: 2400, doors: 'sliding', slidingCount: 3 })
    const result = qaBuild(answers, catalog)
    if (result.kind !== 'cabinet') throw new Error('шкаф күтілді')
    expect(result.cabinet.sliding).toEqual({ count: 3 })
    expect(result.cabinet.sections.every((s) => s.fronts === null)).toBe(true)
  })

  it('стеллаж: есіксіз, шаблонның артқы қабырға режимі сақталады', () => {
    const result = qaBuild(walk({ furniture: 'storage' }).answers, catalog)
    if (result.kind !== 'cabinet') throw new Error('шкаф күтілді')
    expect(result.cabinet.sections.every((s) => s.fronts === null)).toBe(true)
    expect(result.cabinet.back.mode).toBe('none')
  })

  it('ішінара жауап — қалғаны әдепкімен, нәтиже бірдей (детерминді)', () => {
    const partial: QaAnswers = { furniture: 'entry', width: 1000 }
    expect(qaBuild(partial, catalog)).toEqual(qaBuild(partial, catalog))
    expect(qaBuild(partial, catalog)).toEqual(qaBuild(walk(partial).answers, catalog))
  })

  it('бұрыштық ас үй: қабырғалар мен материал generateKitchen-ге түседі', () => {
    const front = catalog.materials.find((m) => m.id === 'ldsp16-h1145')!.id
    const { answers } = walk({ furniture: 'kitchen', layout: 'corner', lengthA: 3200, lengthB: 1800,
      upper: 'no', frontMaterialId: front })
    const result = qaBuild(answers, catalog)
    if (result.kind !== 'kitchen') throw new Error('ас үй күтілді')
    expect(result.options).toMatchObject({ layout: 'corner', lengthA: 3200, lengthB: 1800, upper: false })
    expect(result.kitchen.cabinets.length).toBeGreaterThan(3)
    expect(result.kitchen.cabinets.some((c) => c.id.includes('-up-'))).toBe(false)
    const withUpper = qaBuild({ ...answers, upper: 'yes' }, catalog)
    if (withUpper.kind !== 'kitchen') throw new Error('ас үй күтілді')
    expect(withUpper.kitchen.cabinets.some((c) => c.id.includes('-up-'))).toBe(true)
    // Екінші қабырға шынымен қолданылады: түзу ас үймен бірдей емес.
    const straight = qaBuild({ ...answers, layout: 'straight' }, catalog)
    if (straight.kind !== 'kitchen') throw new Error('ас үй күтілді')
    expect(result.kitchen.placements.length).toBeGreaterThan(straight.kitchen.placements.length)
    expect(result.kitchen.cabinets.filter((c) => c.sections.some((s) => s.fronts)).every((c) => c.frontMaterialId === front)).toBe(true)
  })

  it('ЖИ жолы — тек интернет белгісімен, бар /api/variants пішінінде; ас үйге жоқ', () => {
    const request = qaAiRequest({ furniture: 'wardrobe', width: 1600, hanging: 'yes' }, catalog)
    expect(request).toMatchObject({ requiresInternet: true, endpoint: '/api/variants',
      body: { constraints: { width: 1600, height: defaultSizeOf('wardrobe').height } } })
    expect(request!.body.prompt).toContain('штанга')
    expect(qaAiRequest({ furniture: 'kitchen' }, catalog)).toBeNull()
  })
})
