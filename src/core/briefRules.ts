/**
 * Техзадание → варианттар, ИНТЕРНЕТСІЗ.
 *
 * B фазада бұл жұмысты модель істейтін (`/api/variants`, OpenAI). Оның үш
 * қатері бар: кілт керек, ақша кетеді, әрі модель кейде ЖИНАЛМАЙТЫН корпус
 * ұсынады (сол себепті жарамсыз вариант тізімнен шығарылады). Ал тапсырманың
 * өзі шын мәнінде ЕРЕЖЕГЕ келеді: цехта дайын шаблондар кітапханасы бар,
 * ал клиенттің сөзінен керегі — түрі, габариті және не сақталатыны.
 *
 * Сондықтан мұнда МОДЕЛЬСІЗ жол жазылған:
 *   мәтін → `parseBriefRequest` (кілт сөздер мен сандар)
 *         → `ruleVariants` (шаблондарды бағалау, өлшемге келтіру, толтыру)
 *         → үш нақты `CabinetConfig`
 *
 * Артықшылығы — нәтиже ӘРҚАШАН жиналады: варианттар нағыз шаблоннан шығады
 * әрі әрқайсысы `generateCabinet` арқылы ТЕКСЕРІЛЕДІ, өтпегені тізімге
 * кірмейді. Модель қосымша ретінде қалады (сөзді жақсы түсінеді), бірақ
 * оның болмауы жұмысты тоқтатпайды.
 */

import { generateCabinet } from './generateCabinet'
import { BRIEF_LIMITS } from './brief'
import { SEED_TEMPLATES, templateToCabinet } from './templates'
import type { CabinetTemplate, TemplateCategory } from './templates'
import type { CabinetConfig, Catalog, Section, SectionContent } from './types'

export type BriefRequest = {
  kind: TemplateCategory
  /** Габарит, мм. Рет H × W × D. */
  height: number
  width: number
  depth: number
  /** Киім ілетін штанга керек пе. */
  hanging: boolean
  /** Қанша суырма (ящик). 0 — керек емес. */
  drawers: number
  /** Есік (фасад) керек пе. `false` — ашық сөрелер. */
  doors: boolean
  /** Купе есігі (жылжымалы). */
  sliding: boolean
}

/**
 * Түр бойынша ӘДЕТТЕГІ габарит. Ойдан алынбаған: әр түрдің ең кең тараған
 * шаблонының өлшемі. Клиент санды айтпаса, осы алынады да, экранда бірден
 * көрінеді — «болжадым» деп үнсіз қалмайды.
 */
export function defaultSizeOf(kind: TemplateCategory): { height: number; width: number; depth: number } {
  const first = SEED_TEMPLATES.find((t) => t.category === kind) ?? SEED_TEMPLATES[0]!
  return { height: first.height, width: first.width, depth: first.depth }
}

// ── Мәтінді оқу ──────────────────────────────────────────────────────────────

/**
 * Кілт сөздер. Қазақша да, орысша да — цехта екеуі араласып сөйлейді.
 * Мұнда морфология ЖОҚ: тек түбірдің басы салыстырылады, ал ол осы тапсырмаға
 * жеткілікті («шкафа», «шкафчик», «шкафты» — бәрі «шкаф»-тан басталады).
 */
const KIND_WORDS: { kind: TemplateCategory; words: string[] }[] = [
  { kind: 'kitchen', words: ['кухн', 'кухон', 'ас үй', 'асүй', 'ac үй'] },
  { kind: 'wardrobe', words: ['шкаф', 'гардероб', 'купе', 'киім'] },
  { kind: 'living', words: ['гостин', 'тумб', 'тв', 'телевизор', 'қонақ'] },
  { kind: 'desk', words: ['стол', 'парт', 'рабоч', 'үстел', 'жазу'] },
  { kind: 'bed', words: ['кроват', 'спальн', 'төсек', 'кереует'] },
  { kind: 'storage', words: ['стеллаж', 'полк', 'кладов', 'хранен', 'сөре', 'қойма'] },
]

const HANGING_WORDS = ['штанг', 'вешал', 'плечик', 'ілу', 'ілгіш', 'киім іл']
const DOOR_WORDS = ['двер', 'фасад', 'есік', 'закрыт', 'жабық']
const OPEN_WORDS = ['открыт', 'без двер', 'ашық', 'есіксіз']
const SLIDING_WORDS = ['купе', 'раздвиж', 'жылжымал']
const DRAWER_WORDS = ['ящик', 'выдвижн', 'суырма', 'жәшік']

const has = (text: string, words: string[]): boolean => words.some((w) => text.includes(w))

/**
 * Габаритті мәтіннен алу.
 *
 * Екі жазылу түрі қолдау табады:
 *   «2200x1800x600» — рет H × W × D (жобаның бүкіл келісімі, §0.1);
 *   «высота 2200», «ширина 1800», «биіктігі 2200» — сөзбен.
 * Табылмағаны әдепкіден алынады.
 */
function parseSize(
  text: string,
  fallback: { height: number; width: number; depth: number },
): { height: number; width: number; depth: number } {
  const triple = text.match(/(\d{3,4})\s*[x×хна*]\s*(\d{3,4})\s*[x×хна*]\s*(\d{3,4})/)
  if (triple) {
    return { height: Number(triple[1]), width: Number(triple[2]), depth: Number(triple[3]) }
  }

  const named = (words: string[]): number | null => {
    for (const word of words) {
      const match = text.match(new RegExp(`${word}[^0-9]{0,12}(\\d{3,4})`))
      if (match) return Number(match[1])
    }
    return null
  }
  return {
    height: named(['высот', 'биікт', 'бойы']) ?? fallback.height,
    width: named(['ширин', 'ені', 'енi']) ?? fallback.width,
    depth: named(['глубин', 'тереңд', 'терең']) ?? fallback.depth,
  }
}

/** «3 ящика», «ящиков 4», «2 суырма» — саны табылмаса, әдепкі 3. */
function parseDrawers(text: string): number {
  if (!has(text, DRAWER_WORDS)) return 0
  const before = text.match(/(\d{1,2})\s*(?:шт\.?\s*)?(?:ящик|выдвижн|суырма|жәшік)/)
  // `\w` кириллицаны ТАНЫМАЙДЫ (ол тек [A-Za-z0-9_]), сондықтан «ящиков 2»
  // дегендегі жалғауды `\S*` арқылы өткіземіз.
  const after = text.match(/(?:ящик|суырма|жәшік)\S*\s*(\d{1,2})/)
  const value = Number(before?.[1] ?? after?.[1] ?? 3)
  return Math.min(8, Math.max(1, value))
}

/**
 * Клиенттің сөзінен өтінім құру. Мәтін бос болса да ЖАРАМДЫ өтінім қайтады:
 * пайдаланушы одан әрі формада түзетеді, ал экран бос тұрып қалмайды.
 */
export function parseBriefRequest(text: string): BriefRequest {
  const lower = text.toLowerCase()
  const kind = KIND_WORDS.find((k) => has(lower, k.words))?.kind ?? 'wardrobe'
  const size = parseSize(lower, defaultSizeOf(kind))
  const sliding = has(lower, SLIDING_WORDS)

  return {
    kind,
    ...size,
    // Купе — есіктің өзі, сондықтан ол айтылса, есік те бар.
    doors: sliding || (has(lower, DOOR_WORDS) && !has(lower, OPEN_WORDS)) || (!has(lower, OPEN_WORDS) && kind !== 'storage' && kind !== 'desk'),
    hanging: has(lower, HANGING_WORDS) || (kind === 'wardrobe' && !has(lower, OPEN_WORDS)),
    drawers: parseDrawers(lower),
    sliding,
  }
}

// ── Шаблонды өтінімге келтіру ────────────────────────────────────────────────

const dimensions = ['height', 'width', 'depth'] as const

function validSize(request: BriefRequest): boolean {
  return dimensions.every((axis) => Number.isSafeInteger(request[axis])
    && request[axis] >= BRIEF_LIMITS.dimension.min
    && request[axis] <= BRIEF_LIMITS.dimension.max)
}

function templateFits(template: CabinetTemplate, request: BriefRequest): boolean {
  return dimensions.every((axis) => request[axis] >= template.range[axis].min
    && request[axis] <= template.range[axis].max)
}

/**
 * Шаблонның өтінімге сәйкестігі. Кіші сан — жақсырақ.
 *
 * Габарит АЙЫРМАСЫ пайызбен есептеледі: 100 мм айырма шкафта да, тумбада да
 * бірдей маңызды емес. Функциялар (штанга, ящик, есік, купе) — қосымша айып:
 * сұралғаны шаблонда болмаса, оны кейін ҚОСУҒА болады, бірақ бірден бар
 * шаблон әрқашан жақсырақ.
 */
function scoreTemplate(template: CabinetTemplate, request: BriefRequest): number {
  const diff = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b)
  let score = diff(template.height, request.height)
    + diff(template.width, request.width) * 1.5
    + diff(template.depth, request.depth)

  const contents = template.sections.flatMap((s) => s.contents)
  const hasRod = contents.some((c) => c.kind === 'rod')
  const hasDrawers = contents.some((c) => c.kind === 'drawers')
  const hasFronts = template.sections.some((s) => s.fronts !== null) || template.sliding !== undefined

  if (request.hanging !== hasRod) score += 0.35
  if ((request.drawers > 0) !== hasDrawers) score += 0.3
  if (request.doors !== hasFronts) score += 0.4
  if (request.sliding !== (template.sliding !== undefined)) score += 0.5

  return score
}

/** Секцияға сұралған толтырылымды кіргізу. Бар жолақтар ҚАЙТА ЖАЗЫЛМАЙДЫ. */
function fillSection(section: Section, request: BriefRequest, isFirst: boolean): Section {
  const contents: SectionContent[] = [...section.contents]
  const kinds = new Set(contents.map((c) => c.kind))

  // Ящиктер ӘРҚАШАН төменде — нақты жиһаз солай жиналады (templates.ts қара).
  if (isFirst && request.drawers > 0 && !kinds.has('drawers')) {
    contents.unshift({ kind: 'drawers', count: request.drawers })
  }
  if (isFirst && request.hanging && !kinds.has('rod')) {
    contents.push({ kind: 'rod' })
  }
  // Бос жолақ пен нақты толтырылым қатар тұрмауы керек: бос жолақ биіктіктің
  // жартысын алып, қалғанын қысып тастайды.
  const meaningful = contents.filter((c) => c.kind !== 'empty')
  const next = meaningful.length > 0 ? meaningful : contents

  return {
    ...section,
    contents: next,
    fronts: request.doors ? (section.fronts ?? { count: 1, mount: 'overlay' }) : null,
  }
}

export type RuleVariant = {
  /** Қай шаблоннан шықты — пайдаланушы галереядан таба алады. */
  templateId: string
  name: string
  /** Неге дәл осылай — бір сөйлем, карточкада тұрады. */
  rationale: string
  cabinet: CabinetConfig
}

function describe(template: CabinetTemplate, request: BriefRequest): string {
  const parts: string[] = [`${request.height} × ${request.width} × ${request.depth} мм`]
  if (request.sliding) parts.push('двери-купе')
  else if (request.doors) parts.push('распашные фасады')
  else parts.push('открытые полки')
  if (request.hanging) parts.push('штанга для одежды')
  if (request.drawers > 0) parts.push(`${request.drawers} ящика`)
  return `${template.name}: ${parts.join(', ')}`
}

/**
 * Өтінімнен варианттар. Модель ДЕ, интернет ТЕ керек емес.
 *
 * Әр вариант `generateCabinet` арқылы тексеріледі: жиналмайтыны тізімге
 * кірмейді. Сондықтан пайдаланушыға көрінген нәрсе — әрқашан кесуге келетін
 * корпус (модель жолындағы ереже де дәл осы).
 */
export function ruleVariants(
  request: BriefRequest,
  catalog: Catalog,
  count = 3,
): RuleVariant[] {
  if (!validSize(request)) return []

  const ranked = [...SEED_TEMPLATES]
    .filter((t) => t.category === request.kind && templateFits(t, request))
    .sort((a, b) => scoreTemplate(a, request) - scoreTemplate(b, request))

  const out: RuleVariant[] = []
  for (const template of ranked) {
    if (out.length >= count) break

    const base = templateToCabinet(template, catalog)
    const sections = base.sections.map((s, i) => fillSection(s, request, i === 0))

    const cabinet: CabinetConfig = {
      ...base,
      // Өлшемді үнсіз өзгертпейміз: тек сол өлшемді көтеретін шаблондар қалды.
      height: request.height,
      width: request.width,
      depth: request.depth,
      sections,
      name: template.name,
    }

    /*
     * Купе мен ілмелі фасад ҚАТАР болмайды (types.ts).
     *   купе сұралса  — секция фасадтары алынады;
     *   сұралмаса     — шаблонда купе болса да ӨШІРІЛЕДІ, әйтпесе «есіксіз»
     *                   деген өтінімге купе есікті шкаф шығып кетер еді.
     */
    const resolved: CabinetConfig = request.sliding
      ? {
        ...cabinet,
        sliding: base.sliding ?? { count: 2 },
        sections: cabinet.sections.map((s) => ({ ...s, fronts: null })),
      }
      : { ...cabinet, sliding: undefined }

    try {
      generateCabinet(resolved, catalog)
    } catch {
      // Жиналмайтын вариант ҮНСІЗ ТҮЗЕТІЛМЕЙДІ — ол жай ғана ұсынылмайды.
      continue
    }

    out.push({
      templateId: template.id,
      name: template.name,
      rationale: describe(template, request),
      cabinet: resolved,
    })
  }

  return out
}
