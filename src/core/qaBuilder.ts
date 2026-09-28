/**
 * «Сұрақ-жауап боты» арқылы құрастыру — ЕРЕЖЕЛІК өзек (qdesign-тен қалған
 * функция, 03g §4). ИНТЕРНЕТСІЗ жұмыс істейді.
 *
 * Ағын қатаң әрі детерминді:
 *   жиһаз түрі → габарит (қабырға ұзындығы / биіктік / тереңдік)
 *   → секция / есік / ящик (ас үйде: пішін, қабырғалар, жоғарғы қатар)
 *   → материалдар → дайын конфиг.
 *
 * Конфигті бұл файл ӨЗІ ОЙЛАП ТАППАЙДЫ: шкаф `briefToCabinet` арқылы,
 * ас үй `generateKitchen` арқылы шығады, әрі нәтиже `generateCabinet`-пен
 * ТЕКСЕРІЛЕДІ. Жиналмайтын жауап — `ConfigValidationError`, үнсіз түзету жоқ.
 *
 * Әр сұрақтың «әдепкісі» бар: пайдаланушы кез келген сәтте «дайын» деп,
 * қалғанын әдепкімен толтыра алады. Әдепкі габарит — сол түрдің ең кең
 * тараған шаблонының өлшемі (`defaultSizeOf`), материал — сол шаблондікі.
 *
 * ЖИ жолы — ҚОСЫМША, тек ИНТЕРНЕТ арқылы: бар `/api/variants` маршрутына
 * жіберілетін сұрау (`qaAiRequest`). Ол бұл файлда ШАҚЫРЫЛМАЙДЫ.
 */

import { BRIEF_LIMITS, briefToCabinet } from './brief'
import type { CabinetBrief } from './brief'
import { defaultSizeOf } from './briefRules'
import { ConfigValidationError } from './errors'
import { generateCabinet } from './generateCabinet'
import { generateKitchen } from './kitchen'
import type { KitchenLayout, KitchenResult } from './kitchen'
import { SEED_TEMPLATES } from './templates'
import type { TemplateCategory } from './templates'
import type { CabinetConfig, Catalog, Material, SectionContent } from './types'

export type QaFurniture = 'wardrobe' | 'storage' | 'living' | 'entry' | 'kitchen'

export type QaQuestionId =
  | 'furniture'
  | 'width' | 'height' | 'depth'
  | 'sections' | 'doors' | 'doorsPerSection' | 'slidingCount' | 'shelvesPerSection' | 'drawers' | 'hanging'
  | 'layout' | 'lengthA' | 'lengthB' | 'lengthC' | 'upper' | 'sink' | 'appliances'
  | 'carcassMaterialId' | 'frontMaterialId'

export type QaChoice = { value: string; label: string }

export type QaQuestion =
  | { id: QaQuestionId; kind: 'choice'; text: string; options: QaChoice[]; default: string }
  | { id: QaQuestionId; kind: 'number'; text: string; unit: 'мм' | 'шт'; min: number; max: number; default: number }

export type QaAnswers = Partial<Record<QaQuestionId, string | number>>

export type QaResult =
  | { kind: 'cabinet'; cabinet: CabinetConfig }
  | { kind: 'kitchen'; kitchen: KitchenResult; options: import('./kitchen').KitchenOptions }

const FURNITURE: QaChoice[] = [
  { value: 'wardrobe', label: 'Шкаф / гардероб' },
  { value: 'entry', label: 'Прихожая' },
  { value: 'storage', label: 'Стеллаж / хранение' },
  { value: 'living', label: 'Гостиная / ТВ-зона' },
  { value: 'kitchen', label: 'Кухня' },
]

const YES_NO: QaChoice[] = [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }]

/** Ас үй қабырғасының шегі, мм: бір модульден (300) бір бөлменің ұзындығына дейін. */
const KITCHEN_LENGTH = { min: 300, max: 8000 } as const
/** Купе есігінің саны: жүйе 2-ден аз есікпен жылжымайды. */
const SLIDING_DOORS = { min: 2, max: 6 } as const

// ── Жауаптарды оқу ───────────────────────────────────────────────────────────

const text = (answers: QaAnswers, id: QaQuestionId): string | undefined => {
  const value = answers[id]
  return typeof value === 'string' ? value : undefined
}
const num = (answers: QaAnswers, id: QaQuestionId): number | undefined => {
  const value = answers[id]
  return typeof value === 'number' ? value : undefined
}

function furnitureOf(answers: QaAnswers): QaFurniture {
  return (text(answers, 'furniture') ?? 'wardrobe') as QaFurniture
}

/** Түрдің базалық шаблоны — әдепкі габарит пен материал осыдан. */
function baseTemplate(kind: QaFurniture) {
  const category: TemplateCategory = kind
  return SEED_TEMPLATES.find((t) => t.category === category) ?? SEED_TEMPLATES[0]!
}

/**
 * Корпус пен фасадқа жарайтын ПАРАҚ материалдары: тақта емес, кромка
 * жиынтығы бар, әрі шаблондардағы ЕҢ ЖҰҚА корпус материалынан жұқа емес
 * (ХДФ артқы қабырға корпусқа жарамайды). Шек ойдан алынбаған — шаблондар
 * кітапханасының өзінен шығады.
 */
function boardMaterials(catalog: Catalog): Material[] {
  const carcassIds = new Set(SEED_TEMPLATES.map((t) => t.carcassMaterialId))
  const thicknesses = catalog.materials.filter((m) => carcassIds.has(m.id)).map((m) => m.thickness)
  const minThickness = thicknesses.length > 0 ? Math.min(...thicknesses) : 0
  return catalog.materials.filter((m) => !m.slab && m.defaultEdging !== undefined && m.thickness >= minThickness)
}

function materialDefault(catalog: Catalog, preferred: string): string {
  const boards = boardMaterials(catalog)
  return boards.some((m) => m.id === preferred) ? preferred : boards[0]?.id ?? preferred
}

// ── Сұрақтар ─────────────────────────────────────────────────────────────────

/**
 * Берілген жауаптарға сай сұрақтар тізімі, РЕТІМЕН. Тізім жауапқа қарай
 * өзгереді: «Кухня» таңдалса — секция емес, қабырғалар сұралады.
 */
export function qaQuestions(answers: QaAnswers, catalog: Catalog): QaQuestion[] {
  const kind = furnitureOf(answers)
  const questions: QaQuestion[] = [
    { id: 'furniture', kind: 'choice', text: 'Что будем делать?', options: FURNITURE, default: 'wardrobe' },
  ]
  const boards = boardMaterials(catalog).map((m) => ({ value: m.id, label: m.name }))
  const template = baseTemplate(kind)

  if (kind === 'kitchen') {
    const layout = text(answers, 'layout') ?? 'straight'
    questions.push(
      { id: 'layout', kind: 'choice', text: 'Форма кухни?', default: 'straight', options: [
        { value: 'straight', label: 'Прямая (одна стена)' },
        { value: 'corner', label: 'Угловая (две стены)' },
        { value: 'u', label: 'П-образная (три стены)' },
      ] },
      { id: 'lengthA', kind: 'number', text: 'Длина основной стены?', unit: 'мм', ...KITCHEN_LENGTH, default: 3000 },
    )
    if (layout === 'corner' || layout === 'u') {
      questions.push({ id: 'lengthB', kind: 'number', text: 'Длина второй стены?', unit: 'мм', ...KITCHEN_LENGTH, default: 2000 })
    }
    if (layout === 'u') {
      questions.push({ id: 'lengthC', kind: 'number', text: 'Длина третьей стены?', unit: 'мм', ...KITCHEN_LENGTH, default: 2000 })
    }
    questions.push(
      { id: 'upper', kind: 'choice', text: 'Нужны верхние шкафы?', options: YES_NO, default: 'yes' },
      { id: 'sink', kind: 'choice', text: 'Нужна мойка?', options: YES_NO, default: 'yes' },
      { id: 'appliances', kind: 'choice', text: 'Встраиваем технику (холодильник, духовку)?', options: YES_NO, default: 'yes' },
    )
  } else {
    const size = defaultSizeOf(kind)
    const { min, max } = BRIEF_LIMITS.dimension
    questions.push(
      { id: 'width', kind: 'number', text: 'Длина стены под мебель (ширина)?', unit: 'мм', min, max, default: size.width },
      { id: 'height', kind: 'number', text: 'Высота?', unit: 'мм', min, max, default: size.height },
      { id: 'depth', kind: 'number', text: 'Глубина?', unit: 'мм', min, max, default: size.depth },
    )
    const width = num(answers, 'width') ?? size.width
    const sectionsDefault = Math.min(BRIEF_LIMITS.sections.max, Math.max(1, Math.round(width / 600)))
    questions.push(
      { id: 'sections', kind: 'number', text: 'Сколько вертикальных секций?', unit: 'шт', ...BRIEF_LIMITS.sections, default: sectionsDefault },
      { id: 'doors', kind: 'choice', text: 'Какие двери?', default: kind === 'storage' ? 'none' : 'hinged', options: [
        { value: 'hinged', label: 'Распашные' },
        { value: 'sliding', label: 'Купе' },
        { value: 'none', label: 'Без дверей (открытые полки)' },
      ] },
    )
    const doors = text(answers, 'doors') ?? (kind === 'storage' ? 'none' : 'hinged')
    const sections = num(answers, 'sections') ?? sectionsDefault
    if (doors === 'hinged') {
      questions.push({ id: 'doorsPerSection', kind: 'number', text: 'Сколько дверей на секцию?', unit: 'шт',
        min: 1, max: 2, default: width / sections > 600 ? 2 : 1 })
    }
    if (doors === 'sliding') {
      questions.push({ id: 'slidingCount', kind: 'number', text: 'Сколько дверей-купе?', unit: 'шт',
        ...SLIDING_DOORS, default: Math.min(SLIDING_DOORS.max, Math.max(SLIDING_DOORS.min, sections)) })
    }
    questions.push(
      { id: 'shelvesPerSection', kind: 'number', text: 'Сколько полок в секции?', unit: 'шт', ...BRIEF_LIMITS.shelves, default: 3 },
      { id: 'drawers', kind: 'number', text: 'Сколько ящиков (внизу первой секции)?', unit: 'шт', ...BRIEF_LIMITS.drawers, default: 0 },
    )
    if (kind === 'wardrobe' || kind === 'entry') {
      questions.push({ id: 'hanging', kind: 'choice', text: 'Нужна штанга для одежды?', options: YES_NO, default: 'yes' })
    }
  }

  if (boards.length > 0) {
    questions.push(
      { id: 'carcassMaterialId', kind: 'choice', text: 'Материал корпуса?', options: boards,
        default: materialDefault(catalog, template.carcassMaterialId) },
      { id: 'frontMaterialId', kind: 'choice', text: 'Материал фасадов?', options: boards,
        default: materialDefault(catalog, template.frontMaterialId) },
    )
  }
  return questions
}

/** Келесі жауапсыз сұрақ. `null` — бәрі жауапталды, құрастыруға болады. */
export function qaNextQuestion(answers: QaAnswers, catalog: Catalog): QaQuestion | null {
  return qaQuestions(answers, catalog).find((q) => answers[q.id] === undefined) ?? null
}

/**
 * Жауапты тексеріп қосады. Жарамсыз жауап — `ConfigValidationError`
 * (`answers.<id>` өрісімен және рұқсат аралығымен), үнсіз түзету жоқ.
 * Түр ауысса, оған тәуелді жауаптар тазаланады — ескі шкафтың секциясы
 * ас үйге көшіп кетпеуі керек.
 */
export function qaAnswer(answers: QaAnswers, id: QaQuestionId, value: string | number, catalog: Catalog): QaAnswers {
  const question = qaQuestions(answers, catalog).find((q) => q.id === id)
  const field = `answers.${id}`
  if (!question) throw new ConfigValidationError(field, 'бұл сұрақ қазір қойылмайды', 'qaNextQuestion қайтарған сұрақ')
  if (question.kind === 'choice') {
    if (typeof value !== 'string' || !question.options.some((o) => o.value === value)) {
      throw new ConfigValidationError(field, `«${String(value)}» — нұсқада жоқ`, question.options.map((o) => o.value).join(' | '))
    }
  } else if (typeof value !== 'number' || !Number.isInteger(value) || value < question.min || value > question.max) {
    throw new ConfigValidationError(field, `${String(value)}`, `${question.min}..${question.max} ${question.unit}, бүтін сан`)
  }
  if (id === 'furniture' && answers.furniture !== value) return { furniture: value }
  return { ...answers, [id]: value }
}

/** Жауап не әдепкі: құрастыру әр сұраққа нақты мән алады. */
function resolved(answers: QaAnswers, catalog: Catalog): QaAnswers {
  let current: QaAnswers = { ...answers }
  // Әдепкі алдыңғы жауапқа тәуелді болуы мүмкін (секция саны ⇐ ені), сондықтан ретімен.
  for (let next = qaNextQuestion(current, catalog); next; next = qaNextQuestion(current, catalog)) {
    current = { ...current, [next.id]: next.default }
  }
  return current
}

// ── Құрастыру ────────────────────────────────────────────────────────────────

/** Жауаптардан конфиг. Жетпеген жауап әдепкімен толады; нәтиже генератормен тексеріледі. */
export function qaBuild(answers: QaAnswers, catalog: Catalog): QaResult {
  const all = resolved(answers, catalog)
  // Қолмен құрылған жауаптар да тексеріледі: qaAnswer-ден өтпеген мән болмауы керек.
  for (const question of qaQuestions(all, catalog)) qaAnswer(all, question.id, all[question.id]!, catalog)

  const kind = furnitureOf(all)
  const template = baseTemplate(kind)
  const carcassMaterialId = text(all, 'carcassMaterialId') ?? template.carcassMaterialId
  const frontMaterialId = text(all, 'frontMaterialId') ?? template.frontMaterialId

  if (kind === 'kitchen') {
    const layout = text(all, 'layout') as KitchenLayout
    const options: import('./kitchen').KitchenOptions = {
      layout,
      lengthA: num(all, 'lengthA')!,
      ...(layout !== 'straight' ? { lengthB: num(all, 'lengthB')! } : {}),
      ...(layout === 'u' ? { lengthC: num(all, 'lengthC')! } : {}),
      upper: all.upper === 'yes',
      sink: all.sink === 'yes',
      appliances: all.appliances === 'yes',
      materials: { carcassId: carcassMaterialId, frontId: frontMaterialId },
    }
    const kitchen = generateKitchen(options, catalog)
    for (const cabinet of kitchen.cabinets) generateCabinet(cabinet, catalog)
    return { kind: 'kitchen', kitchen, options }
  }

  const sectionCount = num(all, 'sections')!
  const doors = text(all, 'doors')!
  const drawers = num(all, 'drawers')!
  const shelves = num(all, 'shelvesPerSection')!
  const hanging = all.hanging === 'yes'
  const brief: CabinetBrief = {
    name: FURNITURE.find((f) => f.value === kind)!.label,
    rationale: 'Собрано по ответам на вопросы',
    height: num(all, 'height')!,
    width: num(all, 'width')!,
    depth: num(all, 'depth')!,
    construction: template.construction,
    // Бриф тек overlay/groove біледі; шаблонның нақты режимі (мыс. стеллажда
    // «артқы қабырғасыз») төменде қайта қойылады.
    back: 'overlay',
    carcassMaterialId,
    frontMaterialId,
    backMaterialId: template.backMaterialId,
    sections: Array.from({ length: sectionCount }, (_, i) => ({
      widthMode: 'flex' as const,
      width: null,
      shelfCount: shelves,
      shelfKind: 'adjustable' as const,
      drawerCount: i === 0 ? drawers : 0,
      frontCount: doors === 'hinged' ? num(all, 'doorsPerSection')! : 0,
      frontMount: 'overlay' as const,
    })),
  }
  const base = { ...briefToCabinet(brief, catalog, `cabinet-qa-${kind}`), back: { mode: template.back } }
  /*
   * Штанга: ящиксіз СОҢҒЫ секцияға (бірінші секцияда ящик тұруы мүмкін).
   * Ол секцияның сөрелері штанганың ҮСТІНЕ бір сөреге қысқарады — киім
   * ілінетін кеңістікті сөрелер бөліп тастамауы керек.
   */
  const rodIndex = hanging ? (sectionCount > 1 || drawers === 0 ? sectionCount - 1 : 0) : -1
  const sections = base.sections.map((section, i) => {
    if (i !== rodIndex) return section
    const drawerBand = section.contents.filter((c) => c.kind === 'drawers')
    const contents: SectionContent[] = [...drawerBand, { kind: 'rod' }]
    if (shelves > 0) contents.push({ kind: 'shelves', count: 1, shelfKind: 'fixed' })
    return { ...section, contents }
  })
  const cabinet: CabinetConfig = doors === 'sliding'
    ? { ...base, sections: sections.map((s) => ({ ...s, fronts: null })), sliding: { count: num(all, 'slidingCount')! } }
    : { ...base, sections }
  generateCabinet(cabinet, catalog)
  return { kind: 'cabinet', cabinet }
}

// ── ЖИ жолы (тек интернет арқылы) ────────────────────────────────────────────

export type QaAiRequest = {
  /** Бұл жол желісіз жұмыс істемейді — UI осыны белгілеп көрсетуі керек. */
  requiresInternet: true
  endpoint: '/api/variants'
  body: {
    prompt: string
    constraints: { kind: string; height: number; width: number; depth: number; materialId: string }
  }
}

/**
 * Жауаптарды бар `/api/variants` сұрауына айналдырады (ЖИ жолы, ОПЦИЯ).
 * Ас үй бұл маршрутқа кірмейді (ол тек корпус варианттарын береді), сондықтан
 * оған `null` қайтады — ас үй әрқашан ережелік жолмен құрастырылады.
 */
export function qaAiRequest(answers: QaAnswers, catalog: Catalog): QaAiRequest | null {
  const all = resolved(answers, catalog)
  const kind = furnitureOf(all)
  if (kind === 'kitchen') return null
  const label = FURNITURE.find((f) => f.value === kind)!.label
  const lines = [
    `${label}: ${num(all, 'sections')} секц., полок в секции ${num(all, 'shelvesPerSection')}, ящиков ${num(all, 'drawers')}.`,
    all.doors === 'sliding' ? `Двери-купе: ${num(all, 'slidingCount')} шт.`
      : all.doors === 'hinged' ? `Распашные двери: ${num(all, 'doorsPerSection')} на секцию.` : 'Без дверей, открытые полки.',
  ]
  if (all.hanging === 'yes') lines.push('Нужна штанга для одежды.')
  return {
    requiresInternet: true,
    endpoint: '/api/variants',
    body: {
      prompt: lines.join(' '),
      constraints: {
        kind: label,
        height: num(all, 'height')!,
        width: num(all, 'width')!,
        depth: num(all, 'depth')!,
        materialId: text(all, 'carcassMaterialId') ?? baseTemplate(kind).carcassMaterialId,
      },
    },
  }
}
