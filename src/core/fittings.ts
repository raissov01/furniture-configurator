/**
 * Ілгек жүйелері мен тұтқа модельдері — панельге ТИЕТІН, бірақ параққа
 * түспейтін фурнитура.
 *
 * НЕГЕ БӨЛЕК МОДУЛЬ. Ілгектің бренді тек сметаға әсер етпейді: чашканың
 * жиектен қашықтығы (K) брендке де, накладка шамасына да байланысты, ал ол
 * ПРИСАДКАНЫҢ координатасы. Blum-ға бұрғыланған фасад Boyard-қа бұрылмайды.
 * Сондықтан бренд — сметаның жолы емес, геометрияның кірісі.
 *
 * ЕСКЕРТУ ӨЛШЕМДЕР ТУРАЛЫ (§10 «ойдан константа жазба»). Мұнда жазылғанның
 * ішінде шынымен де жалпыға ортақ стандарт — чашканың Ø35 диаметрі, 32 мм
 * планка қадамы және 37 мм алдыңғы шегініс. Ал `cupFromEdge` (K өлшемі)
 * әр брендтің өз шаблонынан алынады әрі накладкаға қарай өзгереді, сондықтан
 * ол ЦЕХ БАПТАУЫ болып шығарылған: әдепкісі 22 мм (ең кең тараған мән),
 * бірақ цех өз шаблонымен салыстырып түзетуі керек. Бір брендтің санын
 * кодқа бекітсек, ол қалған цехтарға үнсіз ЖАЛҒАН сан болып қалар еді.
 */

import { z } from 'zod'
import type { PanelHandle } from './types'

// ── Ілгек ────────────────────────────────────────────────────────────────────

export type HingeBrand = 'blum' | 'hettich' | 'hafele' | 'gtv' | 'dtc' | 'boyard'

/** Жабылу түрі: доводчикпен (интегрированный) немесе серіппесіз. */
export type HingeClosing = 'soft' | 'none'

/** Иықтың пішіні: крестовая (айқыш) немесе тік. */
export type HingeArm = 'cross' | 'linear'

/** Фасадтың бүйірге қатысты отыруы. */
export type HingeMount = 'overlay' | 'half' | 'inset'

export type HingeSystem = {
  id: string
  brand: HingeBrand
  name: string
  closing: HingeClosing
  arm: HingeArm
  mount: HingeMount
  /** Чашка диаметрі, мм. Іс жүзінде әрқашан 35. */
  cupDiameter: number
  /** Чашканың тереңдігі, мм. */
  cupDepth: number
  /**
   * Чашка ОРТАСЫ фасадтың жиегінен, мм (K өлшемі).
   *
   * ⚠ ЦЕХ ТЕКСЕРУІ КЕРЕК: бұл сан брендтің шаблонына әрі накладка шамасына
   * байланысты. Әдепкі 22 мм — ең жиі кездесетіні, дәлел емес.
   */
  cupFromEdge: number
  /** Шеткі ілгектің фасад ұшынан қашықтығы, мм. */
  endOffset: number
  /** Жауап планкасының екі тесігі, мм аралық. 32 — жүйенің қадамы. */
  plateHoleSpacing: number
  /** Планка тесіктері бүйірдің алдыңғы жиегінен, мм. */
  plateFromFront: number
  /** Сметадағы позиция (`ShopProfile.hardware[].id`). */
  hardwareId: string
  /** Жауап планкасының сметадағы позициясы. */
  plateHardwareId: string
}

const HINGE_BRAND_NAMES: Record<HingeBrand, string> = {
  blum: 'Blum',
  hettich: 'Hettich',
  hafele: 'Häfele',
  gtv: 'GTV',
  dtc: 'DTC',
  boyard: 'Boyard',
}

export function hingeBrandName(brand: HingeBrand): string {
  return HINGE_BRAND_NAMES[brand]
}

/** Чашканың жалпыға ортақ өлшемдері — бұлары брендке қарамайды. */
export const HINGE_CUP_DIAMETER_STD = 35
export const HINGE_CUP_DEPTH_STD = 12.5
export const HINGE_PLATE_PITCH_STD = 32
export const HINGE_PLATE_FROM_FRONT_STD = 37
/** Әдепкі K өлшемі — цех өз шаблонымен салыстырады. */
export const HINGE_CUP_FROM_EDGE_DEFAULT = 22
export const HINGE_END_OFFSET_DEFAULT = 100

function makeHingeSystem(
  brand: HingeBrand,
  closing: HingeClosing,
  arm: HingeArm = 'cross',
  mount: HingeMount = 'overlay',
): HingeSystem {
  const mountRu = mount === 'overlay' ? 'накладная' : mount === 'half' ? 'полунакладная' : 'вкладная'
  const closingRu = closing === 'soft' ? 'с доводчиком' : 'без пружины'
  return {
    id: `hinge-${brand}-${closing}-${arm}-${mount}`,
    brand,
    name: `${HINGE_BRAND_NAMES[brand]}, ${closingRu}, ${mountRu}`,
    closing,
    arm,
    mount,
    cupDiameter: HINGE_CUP_DIAMETER_STD,
    cupDepth: HINGE_CUP_DEPTH_STD,
    cupFromEdge: HINGE_CUP_FROM_EDGE_DEFAULT,
    endOffset: HINGE_END_OFFSET_DEFAULT,
    plateHoleSpacing: HINGE_PLATE_PITCH_STD,
    plateFromFront: HINGE_PLATE_FROM_FRONT_STD,
    hardwareId: `hinge-${brand}-${closing}`,
    plateHardwareId: 'hinge-plate',
  }
}

export const HINGE_BRANDS: HingeBrand[] = ['blum', 'hettich', 'hafele', 'gtv', 'dtc', 'boyard']

/**
 * Бастапқы каталог: әр брендке доводчикпен және серіппесіз екі жүйе.
 * Иық пен накладка — фасадтың баптауы, сондықтан мұнда ең жиі кездесетін
 * тіркесім ғана тұр; цех қалғанын өзі қосады.
 */
export function defaultHingeSystems(): HingeSystem[] {
  const out: HingeSystem[] = []
  for (const brand of HINGE_BRANDS) {
    out.push(makeHingeSystem(brand, 'soft'))
    out.push(makeHingeSystem(brand, 'none'))
  }
  return out
}

export const DEFAULT_HINGE_SYSTEM_ID = 'hinge-blum-soft-cross-overlay'

// ── Тұтқа ────────────────────────────────────────────────────────────────────

/**
 * Тұтқаның ТҮРІ — присадкаға да, 3D-ге де әсер етеді:
 *
 *   bar     — скоба: екі бұранда, аралығы (межцентровое) таңдалады
 *   rail    — рейлинг: сол сияқты, бірақ дөңгелек құбыр
 *   shell   — ракушка (ящикке жиі): екі бұранда, аралығы кіші
 *   knob    — кнопка: БІР бұранда
 *   profile — профиль-ручка (гола): бұранда ЖОҚ, фасадтың жиегіне отырады
 *   none    — тұтқасыз (push-to-open)
 *
 * ⚠ Присадка `boreSpacings`-тен емес, ОСЫ ТҮРДЕН шығады (`handleBorePoints`):
 * жаңа түр қосқанда оның қай топқа жататынын да жазу керек.
 */
export type HandleKind = 'bar' | 'rail' | 'shell' | 'knob' | 'profile' | 'none'

export type HandleModel = {
  id: string
  name: string
  kind: HandleKind
  /** Қолжетімді бұранда аралықтары (межцентровое), мм. `knob`/`profile` → []. */
  boreSpacings: number[]
  /** Бекіту бұрандасының тесігі, мм. */
  boreDiameter: number
  /** Сметадағы позиция. */
  hardwareId: string
}

/**
 * Стандартты межцентровое аралықтар. 32 мм жүйесінің еселіктері —
 * жеткізушінің қайсысы болса да осы қатармен жүреді.
 */
export const HANDLE_BORE_SPACINGS = [
  96, 128, 160, 192, 224, 256, 288, 320, 384, 448, 512, 640, 768, 896, 1024,
] as const

/** Бұранда тесігінің диаметрі: M4 бұрандаға Ø5 өтпелі. */
export const HANDLE_BORE_DIAMETER = 5

/**
 * Тұтқаның ФАСАДТАҒЫ орны. Сегіз нүкте: төрт жиектің ортасы және төрт бұрыш.
 * Бұрыштық нұсқаларда тұтқа жиекке параллель, ұзын жиекті бойлайды.
 */
export type HandlePosition =
  | 'top' | 'bottom' | 'left' | 'right'
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export const HANDLE_POSITIONS: HandlePosition[] = [
  'top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
]

const HANDLE_POSITION_NAMES: Record<HandlePosition, string> = {
  top: 'Сверху',
  bottom: 'Снизу',
  left: 'Слева',
  right: 'Справа',
  topLeft: 'Вверху слева',
  topRight: 'Вверху справа',
  bottomLeft: 'Внизу слева',
  bottomRight: 'Внизу справа',
}

export function handlePositionName(p: HandlePosition): string {
  return HANDLE_POSITION_NAMES[p]
}

/** Фасадқа тағылған нақты тұтқа. */
export type HandleSpec = {
  handleId: string
  /** Таңдалған межцентровое, мм. `knob` үшін мағынасыз (0). */
  boreSpacing: number
  position: HandlePosition
  /**
   * Тұтқаның ОСІ фасадтың жақын ЖИЕГІНЕН, мм.
   * Жиек — `position` көрсететін жиек (мыс. 'top' → жоғарғы жиек).
   */
  edgeOffset: number
  /**
   * Тұтқаның ортасы фасадтың ТОРЦІНЕН, мм.
   * Тек бұрыштық орналасуда қолданылады; ортадағыларда фасад ортасы алынады.
   */
  endOffset: number
}

/**
 * Тұтқалардың БАСТАПҚЫ тізімі.
 *
 * ⚠ БҰЛ — АРТИКУЛ ТІЗІМІ ЕМЕС. Артикул да, баға да жеткізушіден келеді әрі
 * әр цехта басқаша, сондықтан мұнда тек ТҮРЛЕРІ тұр — присадка мен 3D үшін
 * керегі де сол. Цех өз каталогын профильде толықтырады (Фурнитура → Ручки),
 * ал бағасы бұрынғыдай 0 күйінде келеді (§6).
 */
export function defaultHandles(): HandleModel[] {
  const bores = [...HANDLE_BORE_SPACINGS]
  /** Ракушканың аралығы кіші: ол ящиктің фасадына көлденең отырады. */
  const shellBores = [64, 96, 128, 160]
  return [
    {
      id: 'handle-bar', name: 'Ручка-скоба', kind: 'bar',
      boreSpacings: bores, boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-bar',
    },
    {
      id: 'handle-bar-square', name: 'Ручка-скоба квадратная', kind: 'bar',
      boreSpacings: bores, boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-bar-square',
    },
    {
      id: 'handle-bracket', name: 'Ручка-скоба П-образная', kind: 'bar',
      boreSpacings: bores, boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-bracket',
    },
    {
      id: 'handle-rail', name: 'Ручка-рейлинг', kind: 'rail',
      boreSpacings: bores, boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-rail',
    },
    {
      id: 'handle-rail-thin', name: 'Ручка-рейлинг тонкая (Ø10)', kind: 'rail',
      boreSpacings: bores, boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-rail-thin',
    },
    {
      id: 'handle-shell', name: 'Ручка-ракушка', kind: 'shell',
      boreSpacings: shellBores, boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-shell',
    },
    {
      id: 'handle-shell-long', name: 'Ручка-ракушка удлинённая', kind: 'shell',
      boreSpacings: [128, 160, 192, 224], boreDiameter: HANDLE_BORE_DIAMETER,
      hardwareId: 'handle-shell-long',
    },
    {
      id: 'handle-knob', name: 'Ручка-кнопка', kind: 'knob',
      boreSpacings: [], boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-knob',
    },
    {
      id: 'handle-knob-wood', name: 'Ручка-кнопка деревянная', kind: 'knob',
      boreSpacings: [], boreDiameter: HANDLE_BORE_DIAMETER, hardwareId: 'handle-knob-wood',
    },
    {
      id: 'handle-profile', name: 'Профиль-ручка (врезная)', kind: 'profile',
      boreSpacings: [], boreDiameter: 0, hardwareId: 'handle-profile',
    },
    {
      id: 'handle-profile-c', name: 'Профиль-ручка накладная (С-образная)', kind: 'profile',
      boreSpacings: [], boreDiameter: 0, hardwareId: 'handle-profile-c',
    },
    {
      id: 'handle-profile-gola', name: 'Гола-профиль (под фасадом)', kind: 'profile',
      boreSpacings: [], boreDiameter: 0, hardwareId: 'handle-profile-gola',
    },
    {
      id: 'handle-none', name: 'Без ручки (push-to-open)', kind: 'none',
      boreSpacings: [], boreDiameter: 0, hardwareId: 'handle-none',
    },
  ]
}

export const DEFAULT_HANDLE_ID = 'handle-bar'
export const DEFAULT_HANDLE_BORE = 128

/** Тұтқаның әдепкі баптауы — жоғарғы жиектен 35 мм, фасад ортасында. */
export function defaultHandleSpec(): HandleSpec {
  return {
    handleId: DEFAULT_HANDLE_ID,
    boreSpacing: DEFAULT_HANDLE_BORE,
    position: 'top',
    edgeOffset: 35,
    endOffset: 70,
  }
}

/**
 * Тұтқа тесіктерінің фасадтың ӨЗ жазықтығындағы координаталары.
 *
 * Кіріс: фасадтың ГОТОВЫЙ өлшемі. `length` — фасадтың ұзын өлшемі (биіктігі),
 * `width` — ені. Шығыс: `{ along, across }` жұптары, мұндағы `along` — ұзын
 * өсі бойымен (фасадтың астынан), `across` — ені бойымен (сол жақтан).
 * Панельдің локал өсіне аудару — `drilling.ts`-тің ісі.
 *
 * Тесік ЖОҚ болса (профиль-ручка, push-to-open) — бос массив.
 */
export function handleBorePoints(
  model: HandleModel,
  spec: HandleSpec,
  frontLength: number,
  frontWidth: number,
): { along: number; across: number }[] {
  if (model.kind === 'profile' || model.kind === 'none') return []

  const spacing = model.kind === 'knob' ? 0 : Math.max(0, spec.boreSpacing)
  const half = spacing / 2

  // Жиектен қашықтық — тұтқаның осі. Фасадтан шығып кетпеуін қадағалаймыз.
  const clampAlong = (v: number): number => Math.min(Math.max(v, 0), frontLength)
  const clampAcross = (v: number): number => Math.min(Math.max(v, 0), frontWidth)

  const p = spec.position
  const vertical = p === 'left' || p === 'right'

  if (vertical) {
    // Тік тұтқа: бір бағанда, фасадтың биіктігі бойымен таралады.
    const across = p === 'left' ? spec.edgeOffset : frontWidth - spec.edgeOffset
    const centre = frontLength / 2
    return spacing === 0
      ? [{ along: clampAlong(centre), across: clampAcross(across) }]
      : [
        { along: clampAlong(centre - half), across: clampAcross(across) },
        { along: clampAlong(centre + half), across: clampAcross(across) },
      ]
  }

  if (p === 'top' || p === 'bottom') {
    // Көлденең тұтқа фасадтың ортасында.
    const along = p === 'top' ? frontLength - spec.edgeOffset : spec.edgeOffset
    const centre = frontWidth / 2
    return spacing === 0
      ? [{ along: clampAlong(along), across: clampAcross(centre) }]
      : [
        { along: clampAlong(along), across: clampAcross(centre - half) },
        { along: clampAlong(along), across: clampAcross(centre + half) },
      ]
  }

  // Бұрыштар: көлденең, бірақ ортасы торцтен `endOffset` қашықтықта.
  const top = p === 'topLeft' || p === 'topRight'
  const left = p === 'topLeft' || p === 'bottomLeft'
  const along = top ? frontLength - spec.edgeOffset : spec.edgeOffset
  const centre = left ? spec.endOffset : frontWidth - spec.endOffset
  return spacing === 0
    ? [{ along: clampAlong(along), across: clampAcross(centre) }]
    : [
      { along: clampAlong(along), across: clampAcross(centre - half) },
      { along: clampAlong(along), across: clampAcross(centre + half) },
    ]
}

/**
 * Тұтқаның 3D ПІШІНІ фасадтың өз жазықтығында.
 *
 * ⚠ Орны `handleBorePoints`-тен алынады — присадка бұрғылайтын ДӘЛ СОЛ
 * нүктелерден. 3D тұтқаның орнын өзі «болжаса», бір күні тесік бір жерде,
 * ал клиентке көрсетілген тұтқа басқа жерде тұрар еді.
 *
 * Профильде тесік жоқ: ол таңдалған жиекті толық бойлайды. Бұрыштық орын
 * профильде мағынасыз, сондықтан ол жақын жиекке түседі (topLeft → top).
 */
export function handleShape(
  model: HandleModel,
  spec: HandleSpec,
  frontLength: number,
  frontWidth: number,
): PanelHandle | null {
  if (model.kind === 'none') return null
  const p = spec.position

  if (model.kind === 'profile') {
    const edge = p === 'left' || p === 'right' ? p : p.startsWith('top') ? 'top' : 'bottom'
    return edge === 'left' || edge === 'right'
      ? {
        handleId: model.id, kind: 'profile', edge,
        along: frontLength / 2, across: edge === 'left' ? 0 : frontWidth,
        direction: 'along', spacing: 0, length: frontLength,
      }
      : {
        handleId: model.id, kind: 'profile', edge,
        along: edge === 'top' ? frontLength : 0, across: frontWidth / 2,
        direction: 'across', spacing: 0, length: frontWidth,
      }
  }

  const points = handleBorePoints(model, spec, frontLength, frontWidth)
  const first = points[0]
  if (!first) return null
  const last = points[points.length - 1]!
  return {
    handleId: model.id,
    kind: model.kind,
    along: (first.along + last.along) / 2,
    across: (first.across + last.across) / 2,
    direction: p === 'left' || p === 'right' ? 'along' : 'across',
    // Тесіктердің НАҚТЫ аралығы: фасадтан шығып кеткен нүкте қысылса,
    // 3D-дегі скоба да сол қысылған тесіктерге отырады.
    spacing: Math.hypot(last.along - first.along, last.across - first.across),
    length: 0,
  }
}

// ── Zod ──────────────────────────────────────────────────────────────────────

export const HingeSystemSchema = z.object({
  id: z.string().min(1),
  brand: z.enum(['blum', 'hettich', 'hafele', 'gtv', 'dtc', 'boyard']),
  name: z.string(),
  closing: z.enum(['soft', 'none']),
  arm: z.enum(['cross', 'linear']),
  mount: z.enum(['overlay', 'half', 'inset']),
  cupDiameter: z.number().positive(),
  cupDepth: z.number().positive(),
  cupFromEdge: z.number().nonnegative(),
  endOffset: z.number().nonnegative(),
  plateHoleSpacing: z.number().positive(),
  plateFromFront: z.number().nonnegative(),
  hardwareId: z.string().min(1),
  plateHardwareId: z.string().min(1),
})

export const HandleModelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(['bar', 'rail', 'shell', 'knob', 'profile', 'none']),
  boreSpacings: z.array(z.number().positive()),
  boreDiameter: z.number().nonnegative(),
  hardwareId: z.string().min(1),
})

export const HandleSpecSchema = z.object({
  handleId: z.string().min(1),
  boreSpacing: z.number().nonnegative(),
  position: z.enum([
    'top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
  ]),
  edgeOffset: z.number().nonnegative(),
  endOffset: z.number().nonnegative(),
})
