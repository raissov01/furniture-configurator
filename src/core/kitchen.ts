/**
 * Ас үй ГЕНЕРАТОРЫ: қабырға ұзындығынан толық гарнитур.
 *
 * Неге керек. Бізде «Наборы» бекітілген 3-4 модуль ғана еді, ал бәсекелесте
 * (qdesign «Этапты конструктор») қабырға ұзындығын ӨЗІ стандарт модульдерге
 * бөліп, төменгі + үстіңгі қатарды, столешницаны, цокольді, мойканы бір
 * ағыммен шығарады. Осы қабат — соның біздегі жауабы.
 *
 * ⚠ ЖАҢА ГЕОМЕТРИЯ ЖОҚ. Әр модуль — бұрыннан бар, ТЕСТЕЛГЕН шаблон
 * (`kitchen-base-full-600`, `kitchen-sink-800`, `kitchen-wall-600`), тек
 * ені өзгертіледі әрі бетіне столешница/цоколь қосылады. Сондықтан раскрой,
 * присадка, смета бәрі бұрынғы жолмен есептеледі.
 *
 * ⚠ БҰРЫШ. L-гарнитурда екі қатар БІР бұрышта түйісуі керек. Перпендикуляр
 * қатар көршісінің ТЕРЕҢДІГІНЕН басталады (бұрыш кубында соқтығыспас үшін) —
 * дәл `sets.ts`-тегі бұрыш ережесі. V1 солтүстік (+ шығыс) бұрышын құрайды.
 */

import { DEFAULT_HANDLE_BORE, DEFAULT_HANDLE_ID, defaultHandleSpec } from './fittings'
import { ConfigValidationError } from './errors'
import { defaultMillingSpec } from './milling'
import type { MillingPatternId } from './milling'
import { findTemplate, templateToCabinet } from './templates'
import { findFixture } from './filling'
import { planWorktopCutout, worktopFixtureModel } from './worktopFixtures'
import type { Cutout } from './cutouts'
import type { CabinetConfig, CabinetFixture, Catalog, CustomPart, Material, Placement, Section } from './types'

export type KitchenLayout = 'straight' | 'corner' | 'u'

export type KitchenOptions = {
  layout: KitchenLayout
  /** Негізгі қабырғаның ұзындығы, мм */
  lengthA: number
  /** Перпендикуляр қабырға (`corner`/`u`), мм */
  lengthB?: number | undefined
  /** Үшінші қабырға (тек `u` — П-пішін), мм */
  lengthC?: number | undefined
  /** Мойканы қосу (негізгі қабырғаның ортасына) */
  sink?: boolean | undefined
  /** Үстіңгі қатарды қосу */
  upper?: boolean | undefined
  /** Үстіңгі шкафтардың есіктерін ШЫНЫ ету (qdesign сияқты) */
  glassUpper?: boolean | undefined
  /** Үстіңгі шкафтардың астына LED подсветка */
  ledUpper?: boolean | undefined
  /** Техника мен пенал бағаналарын қосу (тоңазытқыш, ящик араласы) */
  appliances?: boolean | undefined
  /**
   * Варочная панель. Берілмесе: техника қосулы болса — газ, әйтпесе жоқ.
   * Ящикті тумбаға отырады (астында кастрюль ящигі — әдеттегі шешім).
   */
  hob?: 'gas' | 'electric' | 'none' | undefined
  /** Ортақ тақтадағы өндірістік ойықтарға артикул мен алдыңғы орын. */
  worktopFixtures?: {
    hobModelId?: string | undefined
    hobFrontInset?: number | undefined
    sinkModelId?: string | undefined
    sinkFrontInset?: number | undefined
  } | undefined
  /** Панельдің үстіне сорғыш (үстіңгі шкафтың орнына). Әдепкі — бар. */
  hood?: boolean | undefined
  /** Өлшемдер (қадам 2). Берілмегені әдепкіден. */
  dims?: {
    lowerHeight?: number | undefined
    lowerDepth?: number | undefined
    plinthHeight?: number | undefined
    upperDepth?: number | undefined
    upperHeight?: number | undefined
    upperElevation?: number | undefined
    worktopOverhang?: number | undefined
    /** Өндірістік ортақ тақтаның толық тереңдігі, мм; берілмесе ескі геометрия. */
    worktopDepth?: number | undefined
    backsplashHeight?: number | undefined
  } | undefined
  /** Материалдар (қадам 5). Берілмегені шаблон материалынан. */
  materials?: {
    carcassId?: string | undefined
    frontId?: string | undefined
    worktopId?: string | undefined
    plinthId?: string | undefined
  } | undefined
  /** Фасад фрезеровкасы (қадам 5). `plain` — тегіс. */
  milling?: MillingPatternId | undefined
  /**
   * АЙҚЫН модуль тізімі (раскладка редакторынан). Берілсе, авто-құрастыру
   * (`composeRun`) орнына ОСЫ қолданылады — пайдаланушы қатарды өзі өзгертсе.
   */
  modules?: { runA: KitchenModule[]; runB: KitchenModule[] } | undefined
}

/** Раскладкадағы бір модуль. */
export type KitchenModule = { kind: ModuleKind; width: number }

/** Раскладка редакторында таңдауға болатын модуль түрлері. */
export const MODULE_KINDS: { kind: ModuleKind; name: string; upper: boolean }[] = [
  { kind: 'baseDoors', name: 'Тумба с фасадом', upper: false },
  { kind: 'baseDrawers', name: 'Тумба с ящиками', upper: false },
  { kind: 'sink', name: 'Мойка', upper: false },
  { kind: 'cornerSink', name: 'Мойка угловая', upper: false },
  { kind: 'dishwasher', name: 'Посудомойка', upper: false },
  { kind: 'hob', name: 'Тумба под варочную панель', upper: false },
  { kind: 'oven', name: 'Пенал духовка+СВЧ', upper: true },
  { kind: 'fridge', name: 'Холодильник', upper: true },
  { kind: 'tall', name: 'Пенал (шкаф)', upper: true },
]

/** Бір орынның ТҮРІ — функционалды кухня біркелкі қорап болмауы үшін. */
type ModuleKind = 'tall' | 'baseDoors' | 'baseDrawers' | 'sink' | 'cornerSink' | 'fridge' | 'oven' | 'dishwasher' | 'hob'

/** Варочная панельдің түрі: айқын берілмесе, техникамен бірге газ. */
function hobFuelOf(options: KitchenOptions): 'gas' | 'electric' | 'none' {
  return options.hob ?? ((options.appliances ?? true) ? 'gas' : 'none')
}


export type KitchenResult = {
  cabinets: CabinetConfig[]
  placements: Placement[]
  room: { width: number; depth: number; height: number }
}

/** Стандарт өлшемдер, мм. qdesign «Этапты конструктор»-дан өлшенген. */
const LOWER_HEIGHT = 720
const LOWER_DEPTH = 500
const PLINTH_HEIGHT = 95
const WORKTOP_OVERHANG = 30
const UPPER_HEIGHT = 720
const UPPER_DEPTH = 320
const UPPER_ELEVATION = 1460
const MODULE_PREFERRED = 600
const MODULE_MIN = 300
const MODULE_MAX = 900
// Генератордағы қабырғаға қойылатын ең аз ұзындық: бір 600 мм ас үй модулі сыяды.
const KITCHEN_WALL_MIN_LENGTH = 600
const ROOM_MARGIN = 400

function validateKitchenWalls(options: KitchenOptions): void {
  const check = (field: 'lengthA' | 'lengthB' | 'lengthC', length: number | undefined): void => {
    if (length === undefined || !Number.isSafeInteger(length) || length < KITCHEN_WALL_MIN_LENGTH) {
      throw new ConfigValidationError(field, 'қабырға ұзындығы жарамсыз', `бүтін мм ≥ ${KITCHEN_WALL_MIN_LENGTH}`)
    }
  }
  check('lengthA', options.lengthA)
  if (options.layout === 'corner' || options.layout === 'u') check('lengthB', options.lengthB)
  if (options.layout === 'u') check('lengthC', options.lengthC)
}

/*
 * ЦЕХТЫҢ фасад/направляющая каталогы осы ЖЕТІ ЕНГЕ есептелген (qdesign
 * «Этапты конструктор» модульдерінен өлшенген, 09-20 sweep.ts дәлелі).
 * `splitRun` қалдықты тең бөлгенде (ескі алгоритм) осы қатардан тыс ен
 * шығатын — сонда фасад бөлек кесіледі, фурнитура сәйкес келмейді.
 */
const STANDARD_WIDTHS = [300, 400, 450, 500, 600, 800, 900]

/**
 * Қабырға ұзындығын шкаф ЕНДЕРІНЕ бөлу.
 *
 * Модуль саны ұзындыққа қарай есептеледі (`n`), сосын бірінші `n − 1` модуль
 * БІРДЕЙ стандарт енге (`STANDARD_WIDTHS`) қойылады, ал қалдықты СОҢҒЫ модуль
 * алады (нақты добор, цех оны солай кеседі — тапсырмадағы «ережелер» §3).
 * Осылай қатарда ЕҢ КӨБІ БІР стандарт емес ен қалады. Қосынды ӘРҚАШАН дәл
 * ұзындыққа тең (бұрыш пен столешница дәлме-дәл отыруы үшін маңызды) —
 * бұл — ЕҢ МАҢЫЗДЫ инвариант, стандартқа жанасу оны бұзбайды.
 *
 * Сәйкес `n`/стандарт ен табылмаса (сирек, тар [min,max] диапазонында),
 * ЕСКІ тең бөлу алгоритміне қайтады — сомасы бәрібір дәл, тек стандартқа
 * жанаспауы мүмкін.
 */
export function splitRun(
  length: number,
  opts: { preferred?: number; min?: number; max?: number } = {},
): number[] {
  const preferred = opts.preferred ?? MODULE_PREFERRED
  const min = opts.min ?? MODULE_MIN
  const max = opts.max ?? MODULE_MAX
  if (length < min) return length > 0 ? [Math.round(length)] : []

  let n = Math.max(1, Math.round(length / preferred))
  while (length / n > max) n += 1
  while (n > 1 && length / n < min) n -= 1

  const snapped = snapToStandardWidths(Math.round(length), n, min, max, preferred)
  if (snapped) return snapped

  const base = Math.floor(length / n)
  const remainder = Math.round(length) - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * `n`-ге жуық модуль санымен `length`-ті стандарт енге жанастырып бөлуге
 * тырысады: `n − 1` модуль БІР стандарт ен (`S`) алады, соңғысы — қалдық.
 * `S` `preferred`-ге ең жақыннан бастап сыналады; `n` да ±2 аралықта
 * ауытқиды (кейбір ұзындықта дәл бастапқы `n`-мен жарамды `S` табылмайды,
 * мыс. добор [min,max]-тан асып кетеді). Ештеңе сәйкес келмесе — `null`
 * (шақырушы ескі тең бөлуге қайтады).
 */
function snapToStandardWidths(
  length: number, n: number, min: number, max: number, preferred: number,
): number[] | null {
  const candidates = [...STANDARD_WIDTHS]
    .filter((w) => w >= min && w <= max)
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
  if (candidates.length === 0) return null

  const nOrder: number[] = [n]
  for (let d = 1; d <= 2; d += 1) {
    if (n - d >= 1) nOrder.push(n - d)
    nOrder.push(n + d)
  }

  for (const cand of nOrder) {
    if (cand === 1) {
      if (length >= min && length <= max) return [length]
      continue
    }
    if (length < cand * min || length > cand * max) continue
    for (const width of candidates) {
      const rest = length - width * (cand - 1)
      if (rest >= min && rest <= max) {
        return Array.from({ length: cand }, (_, i) => (i < cand - 1 ? width : rest))
      }
    }
  }
  return null
}

/*
 * БҰРЫШТЫҚ МОЙКА (qdesign «Мойка угловая», 09-13-те олардың жобасынан
 * өлшенді): корпус 1450 мм, бұрыш жағы СОҚЫР — оны фронт. панель 550 мм
 * жабады (көрші қатардың тумбасы 500 мм + есік пен тұтқаға саңылау). Үстіңгі
 * бұрыштық шкафта соқыр панель 350 мм (үстіңгі тереңдік + саңылау).
 */
const CORNER_SINK_WIDTH = 1450
const CORNER_BLIND = 550
const CORNER_UPPER_BLIND = 350
/*
 * СОРҒЫШ ШКАФЫ (qdesign «Сорғышқа», 09-13-те олардың жобасынан оқылды):
 * ортасындағы труба қорабы — екі стойканың АРАСЫ 120 мм, стойкалар алдыңғы
 * жиектен 120 мм шегініп тұрады (есік пен топса тимеуі үшін).
 */
const HOOD_DUCT_GAP = 120
const HOOD_STAND_INSET = 120
/*
 * Бір столешница тақтасының ең үлкен ұзындығы, мм. Ядроның өлшем шегі
 * (`generateCabinet` MAX_DIMENSION = 4000), ал жеткізушінің ең ұзын тақтасы
 * 4100 — одан ұзын қатарда түйіспе модульдің шекарасына қойылады.
 */
const WORKTOP_PIECE_MAX = 4000
const FRIDGE_WIDTH = 600
const SINK_WIDTH = 800
/*
 * ⚠ 2026-09-20 ЖОЙЫЛДЫ («коллега» тапсырмасы, kitchen.test.ts «биік
 * модуль... түзу»). Бұрын мұнда `TALL_HEIGHT = 2100` тұратын — биік
 * модульдің (пенал/тоңазытқыш/духовка мұнарасы) биіктігі ҚАТЫРЫЛҒАН еді,
 * үстіңгі қатардың геометриясынан (`upperElevation`/`upperHeight`)
 * ТУЫНДАМАЙТЫН. Нәтижесінде пеналдың үсті мен үстіңгі қатардың үсті
 * ӘРТҮРЛІ биіктікте шығатын (әдепкіде 2100 vs 1460+720=2180 — 80 мм),
 * ал `dims`-ті өзгертсе алшақтық тіпті үлкейетін. Енді `generateKitchen`
 * ішінде ЕСЕПТЕЛЕДІ (`towerHeight`): биік модульдің АБСОЛЮТ үсті
 * (цоколь + корпус) дәл `upperElevation + upperHeight`-ке тең болатындай.
 */
const TALL_DEPTH = 560

/**
 * Бір қатарды ФУНКЦИОНАЛДЫ модульдерге құрастыру.
 *
 * Біркелкі қорап емес: техника қосылса, басына тоңазытқыш ПЕНАЛЫ (биік
 * бағана) тұрады, ортасына мойка, ал базалар ЯЩИК пен ЕСІК болып кезектеседі
 * (нақты цехтағыдай). Техника мен мойка ТҰРАҚТЫ енді (600/800) алады, қалған
 * ұзындық базаларға бөлінеді — сол себепті гарнитур ұзындығы қабырғаға дәл
 * сай қалады.
 */
function composeRun(
  length: number,
  opts: { sink: boolean; appliances: boolean; main: boolean; hob?: boolean; corner?: boolean },
): { kind: ModuleKind; width: number }[] {
  let remaining = Math.round(length)
  const APP_W = 600

  /*
   * Г/П-кухняда мойка — БҰРЫШТА (qdesign «Мойка угловая»): соқыр бұрыш
   * пайдаланылады, ал техника бағаналары қатардың АРҒЫ шетіне кетеді.
   * ⚠ Бұрын бұрышта тоңазытқыш бағанасы (тереңдігі 560) тұратын да, көрші
   * қатардың тумбасына 60 мм кіріп тұратын — тексеру оны көрмейтін (09-13).
   */
  const cornerSink = Boolean(opts.corner && opts.main && opts.sink && remaining >= CORNER_SINK_WIDTH + MODULE_MIN)
  if (cornerSink) remaining -= CORNER_SINK_WIDTH

  // Техника — ТҰРАҚТЫ енді ұялар. Негізгі қабырғада: тоңазытқыш пен духовка
  // мұнарасы шетте, посудомойка мойканың қасында.
  // 60 см плитаның ресми ойығы 560 мм: оған кемінде 600 мм база қалсын.
  // Bosch PIE631BB5E б.1,3; қалған техника осы резервті жұтпауы керек.
  const baseReserve = opts.hob ? findFixture('hobGas').minWidth : MODULE_MIN
  const wantFridge = opts.appliances && opts.main && remaining >= APP_W + baseReserve
  if (wantFridge) remaining -= APP_W
  const wantOven = opts.appliances && opts.main && remaining >= APP_W + baseReserve
  if (wantOven) remaining -= APP_W
  const wantSink = !cornerSink && opts.sink && opts.main && remaining >= SINK_WIDTH + baseReserve
  if (wantSink) remaining -= SINK_WIDTH
  const wantDish = opts.appliances && opts.main && (wantSink || cornerSink) && remaining >= APP_W + baseReserve
  if (wantDish) remaining -= APP_W

  const bases = splitRun(remaining).map((width, i): { kind: ModuleKind; width: number } => ({
    kind: opts.appliances && i % 2 === 0 ? 'baseDrawers' : 'baseDoors',
    width,
  }))

  // Варочная панель — ЕҢ СОҢҒЫ жарамды базаға: мойка ортада, тоңазытқыш
  // басында, ал плита олардан алыста тұрады (су мен от қатар тұрмайды).
  if (opts.hob) {
    const min = findFixture('hobGas').minWidth
    for (let i = bases.length - 1; i >= 0; i -= 1) {
      if (bases[i]!.width >= min) {
        bases[i] = { ...bases[i]!, kind: 'hob' }
        break
      }
    }
  }

  const out: { kind: ModuleKind; width: number }[] = []
  if (cornerSink) {
    // Бұрыштан: мойка → посудомойка → тумбалар → бағаналар (арғы шетте).
    out.push({ kind: 'cornerSink', width: CORNER_SINK_WIDTH })
    if (wantDish) out.push({ kind: 'dishwasher', width: APP_W })
    out.push(...bases)
    if (wantOven) out.push({ kind: 'oven', width: APP_W })
    if (wantFridge) out.push({ kind: 'fridge', width: APP_W })
    return out
  }
  if (wantFridge) out.push({ kind: 'fridge', width: APP_W })
  if (wantOven) out.push({ kind: 'oven', width: APP_W })
  if (wantSink) {
    const mid = Math.floor(bases.length / 2)
    out.push(
      ...bases.slice(0, mid),
      { kind: 'sink', width: SINK_WIDTH },
      ...(wantDish ? [{ kind: 'dishwasher' as ModuleKind, width: APP_W }] : []),
      ...bases.slice(mid),
    )
  } else {
    out.push(...bases)
  }
  return out
}

/**
 * Раскладканы АЛДЫН АЛА есептеу (авто). Редактор осыны бастапқы күй ретінде
 * алады, пайдаланушы өзгертеді, сосын `options.modules`-пен қайтарады.
 */
export function kitchenLayout(options: KitchenOptions): { runA: KitchenModule[]; runB: KitchenModule[] } {
  validateKitchenWalls(options)
  const uShape = options.layout === 'u'
  const corner = (options.layout === 'corner' || uShape) && (options.lengthB ?? 0) >= MODULE_MIN
  const sink = options.sink ?? true
  const appliances = options.appliances ?? true
  const wantHob = hobFuelOf(options) !== 'none'
  const runA = composeRun(options.lengthA, { sink, appliances, main: true, hob: wantHob, corner })
  return {
    runA,
    runB: corner
      ? composeRun(options.lengthB!, { sink: false, appliances, main: false, hob: wantHob && !hasHob(runA) })
      : [],
  }
}

/**
 * Қатарда плита бар ма. Негізгі қабырғада техника мен мойкадан соң
 * плитаға жарамды (≥ 450 мм) тумба қалмауы мүмкін — сонда плита КЕЛЕСІ
 * қабырғаға көшеді. Әйтпесе ең жиі гарнитур (бұрыш, 3000 мм) плитасыз шығатын.
 */
function hasHob(run: { kind: ModuleKind }[]): boolean {
  return run.some((m) => m.kind === 'hob')
}

const TEMPLATE_OF: Record<ModuleKind, string> = {
  tall: 'kitchen-tall-600',
  fridge: 'kitchen-tall-600',
  oven: 'kitchen-tall-600',
  baseDoors: 'kitchen-base-full-600',
  baseDrawers: 'kitchen-base-drawers-600',
  dishwasher: 'kitchen-base-full-600',
  sink: 'kitchen-sink-800',
  cornerSink: 'kitchen-sink-800',
  hob: 'kitchen-base-drawers-600',
}

/** Корпусқа техника қосу (сол түрі бұрыннан болса — қайталамай). */
function withFixture(cabinet: CabinetConfig, fixture: CabinetFixture): CabinetConfig {
  const rest = (cabinet.fixtures ?? []).filter((f) => f.kind !== fixture.kind)
  return { ...cabinet, fixtures: [...rest, fixture] }
}

/**
 * Техника ҰЯСЫ бар модуль: секцияның мазмұнын техникаға ауыстырады.
 *
 * Ұяда цех фасады болмайды — техниканың өз есігі бар (тоңазытқыш, духовка).
 * 3D-де техника ӨЗ РЕҢКІМЕН көрінеді (`filling.ts` APPLIANCES). Раскрой тек
 * корпусты санайды: техниканы клиент өзі алады.
 *
 * ⚠ G3 (docs/visual/generator-gaps.md, 2026-09-20). Техника ұясының
 * ҮСТІНДЕ сөре тұрса (мыс. духовка мұнарасында, тоңазытқыш бағанасында),
 * сол сөрені ЖАБАТЫН фасад керек — бұрын БҮКІЛ секция `fronts: null`
 * болатын да, техниканың үстіндегі сөрелер де ашық қалатын («ашық шкаф»
 * көрінісі, аудитте расталды). `keepFronts: true` берілсе, секцияның
 * ӨЗ фасады (шаблоннан) сақталады: `generateCabinet.ts`-тегі
 * `hingedFrontFrom` ережесі (техника бандісі ⇒ фасад содан ЖОҒАРЫ
 * басталады) фасадты техниканың ҮСТІНЕ ҒАНА түсіреді, техниканың өзін
 * жаппайды. Посудомойкада (жұқа қалдық жолақ, нақты есік жоқ) әдепкі
 * бойынша `false` — фасад бұрынғыдай жоқ.
 */
function applianceNiche(
  cabinet: CabinetConfig, contents: Section['contents'], opts: { keepFronts?: boolean } = {},
): CabinetConfig {
  return {
    ...cabinet,
    sections: cabinet.sections.map((sec, i) => (
      i === 0 ? { ...sec, contents, ...(opts.keepFronts ? {} : { fronts: null }) } : sec
    )),
  }
}

/**
 * Үстіңгі шкафтың тұтқасы АСТЫҢҒЫ жиекте: есік 1,5 м биіктікте тұрады,
 * оны астынан тартады. Цехтың әдепкісі (`top`) еденде тұрған шкафқа
 * лайық — үстіңгі қатарда ол қол жетпейтін жерде қалар еді.
 *
 * Модель цехтың КАТАЛОГЫНАН: каталогта жоқ тұтқаны атасақ, ядро қате
 * береді. Тұтқа әдейі алынған секция (`null`) сол күйі қалады.
 */
function handleAtBottom(cabinet: CabinetConfig, catalog: Catalog): CabinetConfig {
  const list = catalog.handles ?? []
  const model = list.find((h) => h.id === DEFAULT_HANDLE_ID) ?? list.find((h) => h.boreSpacings.length > 0)
  if (!model) return cabinet
  const bore = model.boreSpacings.includes(DEFAULT_HANDLE_BORE) ? DEFAULT_HANDLE_BORE : (model.boreSpacings[0] ?? 0)
  return {
    ...cabinet,
    sections: cabinet.sections.map((sec) => {
      if (!sec.fronts || sec.fronts.handle === null) return sec
      const base = sec.fronts.handle ?? { ...defaultHandleSpec(), handleId: model.id, boreSpacing: bore }
      return { ...sec, fronts: { ...sec.fronts, handle: { ...base, position: 'bottom' } } }
    }),
  }
}

/** Секциялардың фасадына фрезеровка өрнегін салу (тегіс болмаса). */
function withMilling(cabinet: CabinetConfig, pattern: MillingPatternId | undefined): CabinetConfig {
  if (!pattern || pattern === 'plain') return cabinet
  const spec = defaultMillingSpec(pattern)
  const sections: Section[] = cabinet.sections.map((sec) =>
    sec.fronts ? { ...sec, fronts: { ...sec.fronts, milling: spec } } : sec)
  return { ...cabinet, sections }
}

/** Секциялардың фасадын ШЫНЫ ету (тек көрініс). */
function withGlass(cabinet: CabinetConfig): CabinetConfig {
  return {
    ...cabinet,
    sections: cabinet.sections.map((sec) =>
      sec.fronts ? { ...sec, fronts: { ...sec.fronts, glass: true } } : sec),
  }
}

/** Материалды бүкіл корпусқа қолдану (берілген өрістер ғана). */
function withMaterials(cabinet: CabinetConfig, m: KitchenOptions['materials']): CabinetConfig {
  if (!m) return cabinet
  return {
    ...cabinet,
    carcassMaterialId: m.carcassId ?? cabinet.carcassMaterialId,
    frontMaterialId: m.frontId ?? cabinet.frontMaterialId,
  }
}

/**
 * Цоколь БІР биіктікте — G2 диагнозы (docs/audit/qdesign-drilling-reference.md
 * §7, docs/visual/generator-gaps.md §G2).
 *
 * ⚠ 2026-09-20 ТҮЗЕТІЛДІ. Бұрын биіктік `cabinet.base?.height`-ті (шаблонның
 * ӨЗ мәні) `PLINTH_HEIGHT`-тен басым қоятын: `kitchen-base-full-600`
 * (баседорс) шаблонында 100 мм тұр, ал `kitchen-base-drawers-600`/
 * `kitchen-sink-800`-те шаблон base мүлде жоқ болғандықтан 95 мм-ге
 * түсетін. Нәтижесінде БІР ҚАТАРДА баседорс пен базящик кезектессе, олардың
 * цокольдары 5 мм-ге сатылап тұратын — нақты генерацияда расталды
 * (`kitchen-a-9`: 100 мм, көршілері: 95 мм). Тұтас цоколь ЖОЛАҒЫ үшін
 * бүкіл қатарда ДӘЛ БІР БИІКТІК керек, сондықтан шаблон мәні енді
 * ЕСКЕРІЛМЕЙДІ — тек жоба параметрі (`dims.plinthHeight`) немесе
 * генератордың әдепкісі (`PLINTH_HEIGHT`).
 */
function dressBase(cabinet: CabinetConfig, opts: KitchenOptions): CabinetConfig {
  const plinthMat = opts.materials?.plinthId ?? opts.materials?.frontId
  return {
    ...cabinet,
    base: {
      kind: 'plinth',
      height: opts.dims?.plinthHeight ?? PLINTH_HEIGHT,
      ...(plinthMat ? { plinthMaterialId: plinthMat } : {}),
    },
  }
}

/**
 * Төменгі модульді ТОЛЫҚ безендіру: цоколь + столешница + (қаласа) фартук,
 * материал мен фрезеровка.
 */
function dressLower(cabinet: CabinetConfig, opts: KitchenOptions): CabinetConfig {
  const dims = opts.dims
  const worktopMat = opts.materials?.worktopId
  let out: CabinetConfig = {
    ...dressBase(cabinet, opts),
    worktop: {
      /*
       * Шығыңқы БҮКІЛ гарнитурға БІРДЕЙ. ⚠ Бұрын шаблонның өз мәні (кейбірінде
       * 20) генератордікінен (30) басым еді де, бір кухняда 20 мен 30 аралас
       * шығатын. Әр тумбаның өз столешницасы болғанда бұл байқалмады, ал
       * ортақ тақтада шығыңқы біреу ғана: алдыңғы жиегі тісті, мойка мен плита
       * әр тереңдікте болар еді (09-13-те тест ұстады).
       */
      overhangFront: dims?.worktopOverhang ?? WORKTOP_OVERHANG,
      overhangSides: 0,
      ...(worktopMat ? { materialId: worktopMat } : {}),
    },
  }
  if (dims?.backsplashHeight && dims.backsplashHeight > 0) {
    out = { ...out, backsplash: { height: dims.backsplashHeight } }
  }
  return withMilling(withMaterials(out, opts.materials), opts.milling)
}

/**
 * Гарнитурды генерациялау.
 *
 * Қайтарғаны `setToProject`-пен бірдей пішінде (корпустар + орындар + бөлме),
 * сондықтан оны стордың бар жүктеу жолы қабылдай алады.
 */
export function generateKitchen(options: KitchenOptions, catalog: Catalog): KitchenResult {
  validateKitchenWalls(options)
  const requestedWorktopId = options.materials?.worktopId
  if (requestedWorktopId) {
    const worktop = catalog.materials.find((m) => m.id === requestedWorktopId)
    if (!worktop?.slab) {
      throw new ConfigValidationError(
        'materials.worktopId', requestedWorktopId,
        'каталогтағы дайын тақта (slab) материалы',
      )
    }
  }
  const wallTpl = findTemplate('kitchen-wall-600')!
  const tplOf = (kind: ModuleKind) => findTemplate(TEMPLATE_OF[kind])!

  const cabinets: CabinetConfig[] = []
  const placements: Placement[] = []
  let counter = 0
  const nextId = (role: string) => `kitchen-${role}-${(counter += 1)}`

  const uShape = options.layout === 'u'
  const corner = (options.layout === 'corner' || uShape) && (options.lengthB ?? 0) >= MODULE_MIN
  const sink = options.sink ?? true
  const appliances = options.appliances ?? true
  const withUpper = options.upper ?? true
  const d = options.dims ?? {}
  const lowerH = d.lowerHeight ?? LOWER_HEIGHT
  const lowerD = d.lowerDepth ?? LOWER_DEPTH
  const upperD = d.upperDepth ?? UPPER_DEPTH
  const upperH = d.upperHeight ?? UPPER_HEIGHT
  const upperElev = d.upperElevation ?? UPPER_ELEVATION
  const plinthH = d.plinthHeight ?? PLINTH_HEIGHT
  /*
   * Биік модульдің (пенал/тоңазытқыш/духовка мұнарасы) АБСОЛЮТ үсті
   * (`dressBase`-тен цоколь + корпустың өз биіктігі) үстіңгі қатардың
   * үстімен («еденнен» `upperElev` + өз биіктігі `upperH`) ДӘЛ бір
   * сызықта болуы үшін корпустың ӨЗ биіктігі цоколь мөлшеріне КЕМІТІЛІП
   * есептеледі — әйтпесе пенал упперден дәл цоколь биіктігіне асып кетер еді.
   */
  const towerHeight = upperElev + upperH - plinthH
  const finishUpper = (c: CabinetConfig) => withMilling(withMaterials(c, options.materials), options.milling)
  const glassUpper = options.glassUpper ?? false
  const makeUpper = (width: number, uid: string): CabinetConfig => {
    let cab: CabinetConfig = { ...templateToCabinet(wallTpl, catalog, { width, height: upperH, depth: upperD }), id: uid }
    cab = handleAtBottom(cab, catalog)
    if (glassUpper) cab = withGlass(cab)
    if (options.ledUpper) cab = { ...cab, led: true }
    return finishUpper(cab)
  }

  /*
   * СОРҒЫШ ШКАФЫ плитаның үстінде (qdesign «Сорғышқа»): ортасында труба
   * өтетін ТІК ҚОРАП — екі стойка, арасы 120 мм; есік екеу, тұтқасыз.
   * Бөлек «труба» сорғыш бұл кезде ЖОҚ — шкафтың өзі сорғыштың орны.
   *
   * ⚠ Бізде стойка мен сөре бір жолаққа сыймайды (әр мазмұн — өз жолағы,
   * generateCabinet), сондықтан qdesign-дағы бүйір сөрелер әзірге жоқ.
   */
  const makeHoodCabinet = (width: number, uid: string): CabinetConfig => {
    const cab = makeUpper(width, uid)
    const mat = catalog.materials.find((m) => m.id === cab.carcassMaterialId)
    if (!mat) throw new Error(`сорғыш шкафы: материал табылмады «${cab.carcassMaterialId}»`)
    const t = mat.thickness
    // Ұяның таза ені (бүйірлер крышка мен дноны жабады): W − 2t. Қорап ортада.
    const left = Math.floor((width - 2 * t - HOOD_DUCT_GAP) / 2) - t
    return {
      ...cab,
      name: 'Кухня: шкаф над вытяжкой',
      sections: cab.sections.map((sec, i) => (i === 0
        ? {
          ...sec,
          contents: [{ kind: 'stand' as const, count: 2, at: [left, left + t + HOOD_DUCT_GAP], insets: { front: HOOD_STAND_INSET } }],
          ...(sec.fronts ? { fronts: { ...sec.fronts, handle: null } } : {}),
        }
        : sec)),
    }
  }

  const hobFuel = hobFuelOf(options)
  const runA = options.modules
    ? options.modules.runA
    : composeRun(options.lengthA, { sink, appliances, main: true, hob: hobFuel !== 'none', corner })
  // Қолмен берілген раскладкаға плита ӨЗДІГІНЕН қосылмайды: пайдаланушы
  // оны «Тумба под варочную панель» арқылы өзі қояды.
  const wantHob = hobFuel !== 'none' && !options.modules
  const runB = corner
    ? (options.modules?.runB
      ?? composeRun(options.lengthB!, { sink: false, appliances, main: false, hob: wantHob && !hasHob(runA) }))
    : []
  // Үшінші қабырға (П-пішін) — әрқашан авто (раскладка редакторы А/B ғана).
  const runC = uShape && (options.lengthC ?? 0) >= MODULE_MIN
    ? composeRun(options.lengthC!, {
      sink: false, appliances, main: false, hob: wantHob && !hasHob(runA) && !hasHob(runB),
    })
    : []
  const totalA = runA.reduce((sum, m) => sum + m.width, 0)
  const totalB = runB.reduce((sum, m) => sum + m.width, 0)
  const totalC = runC.reduce((sum, m) => sum + m.width, 0)

  const room = {
    width: Math.max(3000, totalA + ROOM_MARGIN),
    depth: Math.max(3000, (corner ? lowerD + Math.max(totalB, totalC) : 0) + ROOM_MARGIN),
    height: 2700,
  }

  /** Бір модульден корпус жасау (әр түрі — өз шаблоны, өз безендірілуі). */
  const build = (mod: { kind: ModuleKind; width: number }, role: string): CabinetConfig => {
    const id = nextId(role)
    const tower = () => ({ ...templateToCabinet(tplOf(mod.kind), catalog, { width: mod.width, height: towerHeight, depth: TALL_DEPTH }), id })
    if (mod.kind === 'tall') {
      /*
       * Пенал (қойма бағанасы): толық биік, цоколі базалармен БІР биіктікте
       * (`dressBase`, G2). ⚠ 2026-09-20-ге дейін мұнда цоколь мүлде
       * қойылмайтын («kitchen-tall-600» шаблонында `base` жоқ): бағана
       * еденге ЖАЛПАҚ тұратын да, көршілес базалар 95 мм биіктікте
       * тұрғандықтан пенал мен базаның арасында саты, ал пеналдың өз
       * табаны ЖАБЫЛМАҒАН күйінде қалатын — дәл «аяқ ашық тұр» дегені осы.
       */
      return finishUpper(dressBase(tower(), options))
    }
    if (mod.kind === 'fridge') {
      // Тоңазытқыш бағанасы: ұя + үстінде кішкене шкаф. Цоколі — жоғарыдағыдай.
      // G3: `keepFronts` — үстіңгі сөре фасадпен жабылады, тоңазытқыштың
      // өзі — жоқ (`hingedFrontFrom`, generateCabinet.ts).
      return finishUpper(dressBase(applianceNiche(tower(), [
        { kind: 'appliance', appliance: 'fridge' },
        { kind: 'shelves', count: 1, shelfKind: 'adjustable' },
      ], { keepFronts: true }), options))
    }
    if (mod.kind === 'oven') {
      // Духовка мұнарасы: духовка + СВЧ + сөрелер (qdesign «Пенал духовка+СВЧ»).
      // G3: `keepFronts` — сөрелер фасадпен жабылады, духовка мен СВЧ-ға
      // фасад ТИМЕЙДІ (олардың өз есігі бар).
      return finishUpper(dressBase(applianceNiche(tower(), [
        { kind: 'appliance', appliance: 'oven', height: 595 },
        { kind: 'appliance', appliance: 'microwave', height: 380 },
        { kind: 'shelves', count: 2, shelfKind: 'adjustable' },
      ], { keepFronts: true }), options))
    }
    const base = { ...templateToCabinet(tplOf(mod.kind), catalog, { width: mod.width, height: lowerH, depth: lowerD }), id }
    if (mod.kind === 'dishwasher') {
      // Посудомойка: аласа ұя (фасады — техниканікі), цоколь + столешница астынан.
      return dressLower(applianceNiche(base, [{ kind: 'appliance', appliance: 'dishwasher', height: 600 }, { kind: 'empty' }]), options)
    }
    if (mod.kind === 'hob') {
      // Үстіңгі қатар болса, плитаның үстінде СОРҒЫШ ШКАФЫ тұрады (сорғыштың
      // орны сонда) — бөлек «труба» сорғыш тек үстіңгі қатарсыз гарнитурда.
      // ⚠ Екеуі бірге болса, труба (биіктігі 800) шкафтың ішінен өтіп кетер еді.
      let cab = withFixture(base, { kind: 'hob', fuel: hobFuel === 'electric' ? 'electric' : 'gas',
        ...(options.worktopFixtures?.hobModelId ? { modelId: options.worktopFixtures.hobModelId } : {}),
        ...(options.worktopFixtures?.hobFrontInset === undefined
          ? {} : { frontInset: options.worktopFixtures.hobFrontInset }),
      })
      if ((options.hood ?? true) && !withUpper) cab = withFixture(cab, { kind: 'hood' })
      return dressLower(cab, options)
    }
    if (mod.kind === 'sink') return dressLower(withFixture(base, { kind: 'sink',
      ...(options.worktopFixtures?.sinkModelId ? { modelId: options.worktopFixtures.sinkModelId } : {}),
      ...(options.worktopFixtures?.sinkFrontInset === undefined
        ? {} : { frontInset: options.worktopFixtures.sinkFrontInset }),
    }), options)
    if (mod.kind === 'cornerSink') {
      // Соқыр бұрыш `left` жақта: қатардың offset 0-і — дәл бұрыш, ал фронт.
      // панельдің `left`-і корпустың x = 0 жағына тұрады (generateCabinet).
      const blind: CabinetConfig = { ...base, frontPanel: { width: CORNER_BLIND, side: 'left' } }
      return dressLower(withFixture(blind, { kind: 'sink',
        ...(options.worktopFixtures?.sinkModelId ? { modelId: options.worktopFixtures.sinkModelId } : {}),
        ...(options.worktopFixtures?.sinkFrontInset === undefined
          ? {} : { frontInset: options.worktopFixtures.sinkFrontInset }),
      }), options)
    }
    return dressLower(base, options)
  }

  /*
   * Үстіңгі шкаф қай модульдің үстіне қойылады: ПЛИТАДАН басқа кез келген
   * аласа модуль (плитаның үстінде сорғыш тұрады). Биік бағаналар (пенал,
   * тоңазытқыш, духовка мұнарасы) үстіңгі аймақты өздері алады.
   *
   * ⚠ Бұрын солтүстік қабырғада тек есікті/ящикті тумбаның үстіне қойылатын:
   * мойка мен посудомойканың үстінде бос қалып, қатардың шетінде ЖАЛҒЫЗ
   * үстіңгі шкаф ауада ілініп тұрғандай көрінетін (09-13). Ал B/C қабырғасы
   * `kind !== 'hob'` дегенмен биік бағананың үстіне де шкаф қоятын.
   */
  /*
   * БІР ереже үш қабырғаға да (09-13: B/C бұрын `kind !== 'hob'` дейтін де,
   * биік бағананың үстіне де шкаф қоятын). Плитаның үстінде — сорғыш шкафы
   * (сорғыш сұралмаса — ештеңе: ашық плитаның үстіне шкаф ілінбейді),
   * бұрыштық мойканың үстінде — бұрыштық үстіңгі.
   */
  const upperFor = (mod: { kind: ModuleKind; width: number }, uid: string): CabinetConfig | null => {
    if (!withUpper || MODULE_KINDS.some((m) => m.kind === mod.kind && m.upper)) return null
    if (mod.kind === 'hob') return (options.hood ?? true) ? makeHoodCabinet(mod.width, uid) : null
    const up = makeUpper(mod.width, uid)
    // Бұрыштық мойканың үстінде — бұрыштық үстіңгі: соқыр жағы да бұрышта.
    return mod.kind === 'cornerSink' ? { ...up, frontPanel: { width: CORNER_UPPER_BLIND, side: 'left' } } : up
  }

  /*
   * K8 / audit C6+C7: бұрыштағы соқыр панельдің (`frontPanel`) қалыңдығы.
   *
   * Панель — накладной деталь, корпустың АЛДЫНДА тұрады (`generateCabinet.ts`:
   * `z: -panelMat.thickness`), яғни корпустың номиналды тереңдігінен тыс,
   * көрші қабырғаның қатарына қарай шығыңқы. Көрші қатар тек корпус
   * тереңдігінен басталса (`depthAtStart`), соқыр панельге КІРІП тұрады
   * (C6). Материал табылмаса — ҮНСІЗ ЕМЕС, қате лақтырамыз (§10).
   */
  const frontPanelThickness = (cab: CabinetConfig): number => {
    if (!cab.frontPanel) return 0
    const matId = cab.frontPanel.materialId ?? cab.frontMaterialId
    const mat = catalog.materials.find((m) => m.id === matId)
    if (!mat) throw new Error(`бұрыштық соқыр панель: материал табылмады «${matId}»`)
    return mat.thickness
  }

  // ── Негізгі қабырға (солтүстік), бұрыштан оңға (offset 0-ден) ─────────────
  let cursor = 0
  /*
   * Бұрыштағы модульдің ТЕРЕҢДІГІ: көрші қабырғаның қатары дәл одан кейін
   * басталады. Бұрын тұрақты `lowerD` еді — бұрышта пенал (560) тұрса, көрші
   * тумбаға 60 мм кіретін. Екі шеті де ескеріледі (П-пішінде батыс та бұрыш).
   *
   * `depthAtStart`/`depthAtEnd` — таза КОРПУС тереңдігі, столешница
   * есебінде (§ worktop) бұрынғыдай қолданылады. Шығыс қатардың бастапқы
   * ығысуы (`qLower`/`qUpper`) оған соқыр панельдің қалыңдығын қосады.
   */
  let depthAtStart = lowerD
  let depthAtEnd = lowerD
  let cornerLowerPanel = 0
  let cornerUpperPanel = 0
  runA.forEach((mod, i) => {
    const cab = build(mod, 'a')
    cabinets.push(cab)
    placements.push({ cabinetId: cab.id, wall: 'north', offset: cursor })
    if (i === 0) {
      depthAtStart = cab.depth
      cornerLowerPanel = frontPanelThickness(cab)
    }
    if (i === runA.length - 1) depthAtEnd = cab.depth
    const up = upperFor(mod, nextId('a-up'))
    if (up) {
      cabinets.push(up)
      placements.push({ cabinetId: up.id, wall: 'north', offset: cursor, elevation: upperElev })
      if (i === 0) cornerUpperPanel = frontPanelThickness(up)
    }
    cursor += mod.width
  })

  // ── Перпендикуляр қабырға (шығыс) ────────────────────────────────────────
  // Шығыстың offset 0-і ОҢТҮСТІК-ШЫҒЫС бұрышында, ал бізге СОЛТҮСТІК-ШЫҒЫС
  // керек: бұрыштан өлшенген `q`-ды offset-ке ауыстырамыз (depth − q − width).
  // Қатар мойка ТЕРЕҢДІГІ + соқыр панель қалыңдығынан басталады, әйтпесе
  // бұрышта A-мен соқтығысады (C6) не A-дан алшақ тұрады (C7).
  //
  // ТӨМЕНГІ мен ҮСТІҢГІ қатардың ӨЗ бастапқы ығысуы БӨЛЕК (C7): үстіңгі
  // тереңдік төменгіден өзгеше (320 vs 500), ал бір q екеуіне бірдей
  // қолданылса, солтүстіктің үстіңгі қатары шығыс қатардан 164 мм алшақ
  // қалады.
  let qLower = corner ? depthAtStart + cornerLowerPanel : 0
  let qUpper = corner ? upperD + cornerUpperPanel : 0
  runB.forEach((raw) => {
    const mod = raw.kind === 'tall' ? { kind: 'baseDoors' as ModuleKind, width: raw.width } : raw
    const cab = build(mod, 'b')
    cabinets.push(cab)
    placements.push({ cabinetId: cab.id, wall: 'east', offset: room.depth - qLower - mod.width })
    const up = upperFor(mod, nextId('b-up'))
    if (up) {
      cabinets.push(up)
      placements.push({ cabinetId: up.id, wall: 'east', offset: room.depth - qUpper - mod.width, elevation: upperElev })
    }
    qLower += mod.width
    qUpper += mod.width
  })

  // ── Үшінші қабырға (батыс, тек П-пішін) ──────────────────────────────────
  // Батыстың offset 0-і СОЛТҮСТІК-БАТЫС бұрышында, оңтүстікке қарай өседі.
  // Қатар мойка ТЕРЕҢДІГІНЕН басталады (солтүстікпен соқтығыспас үшін).
  let wOff = depthAtEnd
  runC.forEach((raw) => {
    const mod = raw.kind === 'tall' ? { kind: 'baseDoors' as ModuleKind, width: raw.width } : raw
    const cab = build(mod, 'c')
    cabinets.push(cab)
    placements.push({ cabinetId: cab.id, wall: 'west', offset: wOff })
    const up = upperFor(mod, nextId('c-up'))
    if (up) {
      cabinets.push(up)
      placements.push({ cabinetId: up.id, wall: 'west', offset: wOff, elevation: upperElev })
    }
    wOff += mod.width
  })

  /*
   * СТОЛЕШНИЦА — ӘР ҚАБЫРҒАҒА ТҰТАС ТАҚТА (qdesign сияқты, 09-13).
   *
   * Бұрын әр тумбаның ӨЗ столешницасы болатын: деталировкада бір қабырғаға
   * 5–6 кесек, ал цех бір тұтас постформинг тақтаны кеседі. Енді қабырғадағы
   * тумбалардың әр ҮЗДІКСІЗ тобына бір тақта — топтың бірінші корпусында
   * ерікті деталь; корпустарда `shared` (өз детальі жоқ, бірақ қалыңдық пен
   * шығыңқы сол — мойка мен плитаның биіктігі содан). Бағана топты бөледі.
   *
   * Бұрыш: солтүстік тақта бұрыш арқылы ТҰТАС өтеді, көрші қабырғаның тақтасы
   * оған ТІРЕЛЕДІ — шығыңқы мөлшеріне қысқа (qdesign: 3386 тұтас, 2400 тірелген).
   * Материал: шеберде таңдалғаны, әйтпесе цехтың постформинг тақтасы.
   */
  const worktopId = options.materials?.worktopId ?? catalog.materials.find((m) => m.slab)?.id
  const byId = new Map(cabinets.map((c) => [c.id, c]))
  const widthOf = (p: Placement) => byId.get(p.cabinetId)!.width
  for (const wall of ['north', 'east', 'west'] as const) {
    const list = placements
      .filter((p) => p.wall === wall && !(p.elevation ?? 0) && byId.get(p.cabinetId)!.worktop)
      .sort((a, b) => a.offset - b.offset)
    const groups: Placement[][] = []
    let groupLength = 0
    for (const p of list) {
      const last = groups[groups.length - 1]
      const prev = last?.[last.length - 1]
      // Үзіліссіз әрі тақтаның шегіне сыйса — сол топқа; әйтпесе жаңа тақта
      // (түйіспе модульдің шекарасында — цех солай кеседі).
      if (prev && prev.offset + widthOf(prev) === p.offset && groupLength + widthOf(p) <= WORKTOP_PIECE_MAX) {
        last!.push(p)
        groupLength += widthOf(p)
      } else {
        groups.push([p])
        groupLength = widthOf(p)
      }
    }
    for (const group of groups) {
      const head = byId.get(group[0]!.cabinetId)!
      const start = group[0]!.offset
      const end = group[group.length - 1]!.offset + widthOf(group[group.length - 1]!)
      const overhang = head.worktop!.overhangFront
      // Шығыстың offset-і оңтүстіктен солтүстікке өседі: бұрыштағы шеті — `end`.
      // Батыстыкі солтүстіктен оңтүстікке: бұрыштағы шеті — `start`.
      // K8: шығыс қатар енді `depthAtStart + cornerLowerPanel`-ден басталады
      // (`qLower`), сондықтан бұрыштағы нүкте де сол қалыңдықты есептейді.
      const buttEnd = wall === 'east' && corner && end === room.depth - depthAtStart - cornerLowerPanel
      const buttStart = wall === 'west' && start === depthAtEnd
      const part: CustomPart = {
        id: `worktop-${wall}-${start}`,
        label: 'Столешница',
        ...(worktopId ? { materialId: worktopId } : {}),
        length: end - start - (buttEnd ? overhang : 0) - (buttStart ? overhang : 0),
        width: options.dims?.worktopDepth ?? head.depth + overhang,
        position: { x: buttStart ? overhang : 0, y: head.height, z: -overhang },
        plane: 'horizontal',
        edging: 'none',
        note: 'Постформинг, общая на ряд',
      }
      const cutouts: Cutout[] = []
      // Ескі 530 мм тақта өндірістік 595 мм шекке сыймайды. Өндірістік
      // тереңдік/артикул АЙҚЫН берілсе ғана автоматты ойық жоспарлаймыз.
      const manufacturingRequested = options.dims?.worktopDepth !== undefined
        || options.worktopFixtures !== undefined
      if (manufacturingRequested) {
        for (const placement of group) {
          const cabinet = byId.get(placement.cabinetId)!
          for (const fixture of cabinet.fixtures ?? []) {
            if (fixture.kind === 'hood') continue
            if (fixture.kind === 'sink' && !fixture.modelId) {
              throw new ConfigValidationError('worktopFixtures.sinkModelId', 'берілмеген',
                'мойканың нақты артикулын және алдыңғы шегінісін енгізіңіз')
            }
            const model = worktopFixtureModel(fixture.modelId ?? 'hob-60-default')
            if (model.kind !== fixture.kind) {
              throw new ConfigValidationError('fixtures.modelId', fixture.modelId ?? '',
                `${fixture.kind} моделі`)
            }
            const planned = planWorktopCutout(model, {
              panelLength: part.length, panelWidth: part.width,
              centreX: placement.offset - start + cabinet.width / 2 - part.position.x,
              cabinetWidth: cabinet.width,
              ...(fixture.frontInset === undefined ? {} : { frontInset: fixture.frontInset }),
            })
            cutouts.push({ ...planned, id: `${planned.id}-${placement.cabinetId}` })
          }
        }
      }
      for (const p of group) {
        const c = byId.get(p.cabinetId)!
        cabinets[cabinets.indexOf(c)] = {
          ...c,
          worktop: { ...c.worktop!, shared: true, ...(worktopId ? { materialId: worktopId } : {}) },
          ...(c === head ? {
            customParts: [...(c.customParts ?? []), part],
            ...(cutouts.length > 0 ? { panelCutouts: { ...(c.panelCutouts ?? {}), [part.id]: cutouts } } : {}),
          } : {}),
        }
      }
    }
  }

  return { cabinets: mergeSharedPlinths(cabinets, placements, catalog), placements, room }
}

/**
 * ЦОКОЛЬ — көрші модульдердің плинтусын БІР жолаққа біріктіру (G2,
 * docs/visual/generator-gaps.md §G2; диагноз docs/audit/qdesign-drilling-
 * reference.md §7: qdesign «Цоколь (объединенный)», 2633 мм ұзын, 95 мм биік, 16 мм қалың, модуль
 * тізімінде «01.05 Ірге (біріктірілген)»). `dressBase` бүкіл гарнитурға
 * (база + пенал) бір биіктік/материал бергендіктен (2026-09-20,
 * commit c92afad) көрші корпустардың цоколі енді нақты бірігуге дайын.
 *
 * ӘДІСІ столешницамен (`worktop.shared`) БІРДЕЙ — көрші топты жинау,
 * топ басында бір ерікті деталь. БІРАҚ МЕХАНИЗМІ БӨЛЕК: столешница жатық
 * (`ORIENT_HORIZONTAL`) панель, ал цоколь ТІК тұрған (`ORIENT_UPRIGHT`,
 * `length→x, width→y, thickness→z`) панель — `customParts`-тың үш
 * пландасының (`horizontal`/`vertical`/`front`, `geometry.ts`) ешқайсысы
 * дәл осы сәйкестікті бермейді («front» = `ORIENT_FACING` десе, ұзындық
 * БИІКТІККЕ түсіп кетеді — 2026-09-20 дәл осы қатеден таза ORIENT_UPRIGHT-қа
 * көшкен, жоғарыдағы `dressBase`-тің комментарийін қара). Сондықтан бөлек
 * `CustomPart`-қа емес, тікелей `base.sharedSpan`-ға саламыз:
 * `generateCabinet.ts` соны оқып, топтың БАСЫНДА (head) бір ORIENT_UPRIGHT
 * панель шығарады, қалған мүшелерде («shared» ғана, `sharedSpan` жоқ) —
 * меншікті панелі МҮЛДЕ жоқ.
 *
 * Бірікпейтін жағдайлар (тапсырма: күмәнді жерде БІРІКТІРМЕ):
 *   - биіктігі не тиімді материалы (`plinthMaterialId ?? carcassMaterialId`)
 *     әртүрлі — қалыпты жағдайда `dressBase` мұны болдырмайды, бірақ қолмен
 *     құрастырылған/аралас жобаға қорғаныс ретінде тексеріледі;
 *   - `plinthShape === 'box'` — қорапта бүйір/арт тақтайлар бар, тұтас
 *     жолаққа сыймайды («front» ғана бірігеді);
 *   - аралары ашық (offset үзіліссіз болмаса) — тек ТУРА көрші модульдер;
 *   - қабырға (wall) ауысқанда, яғни БҰРЫШТА — біз топтастыруды әр
 *     қабырғаға БӨЛЕК жүргіземіз, сондықтан бұрыш ЕШҚАШАН бірікпейді.
 *     qdesign-нің бұрыштағы мінезі расталмаған — цехпен растау керек;
 *   - бір топ парақтың жиектелген пайдалы аймағына сыяды —
 *     физикалық шектеу: одан ұзын деталь бір парақтан кесілмейді.
 *
 * Биік бағана (пенал/тоңазытқыш/духовка мұнарасы) — ЕНЕДІ: `dressBase`
 * оларға да қатардың биіктігі мен материалын береді, ал «front» пішінді
 * цокольдің геометриясы корпустың ТЕРЕҢДІГІНЕ (`D`) тәуелді емес (тек
 * `settings.plinthSetback`-тен), сондықтан пеналдың тереңдігі басқа болса
 * да (`TALL_DEPTH` ≠ `LOWER_DEPTH`) қатарға қауіпсіз қосылады — qdesign да
 * солай (табалдырық үзілмейді).
 */
export function mergeSharedPlinths(
  cabinets: CabinetConfig[], placements: Placement[], catalog: Catalog,
): CabinetConfig[] {
  const out = [...cabinets]
  const byId = new Map(out.map((c) => [c.id, c]))
  const indexOf = new Map(out.map((c, i) => [c.id, i]))
  const widthOf = (p: Placement) => byId.get(p.cabinetId)!.width
  const plinthMaterial = (c: CabinetConfig): Material | undefined => {
    const matId = c.base?.plinthMaterialId ?? c.carcassMaterialId
    return catalog.materials.find((m) => m.id === matId)
  }
  const fitsSheet = (length: number, height: number, mat: Material): boolean => {
    const usableW = mat.sheetWidth - 2 * mat.trimEdge
    const usableH = mat.sheetHeight - 2 * mat.trimEdge
    return (length <= usableW && height <= usableH)
      || (!mat.hasGrain && length <= usableH && height <= usableW)
  }

  for (const wall of new Set(placements.map((p) => p.wall))) {
    const list = placements
      .filter((p) => {
        if (p.wall !== wall || (p.elevation ?? 0)) return false
        const c = byId.get(p.cabinetId)!
        return c.base?.kind === 'plinth' && c.base.plinthShape !== 'box'
      })
      .sort((a, b) => a.offset - b.offset)

    const groups: Placement[][] = []
    let groupLength = 0
    let groupHeight = 0
    let groupMat: Material | undefined
    for (const p of list) {
      const c = byId.get(p.cabinetId)!
      const h = c.base!.height
      const mat = plinthMaterial(c)
      if (mat && !fitsSheet(widthOf(p), h, mat)) {
        throw new ConfigValidationError(
          'base.plinthMaterialId', `цоколь ұзындығы ${widthOf(p)} мм параққа сыймайды`,
          `${mat.sheetWidth - 2 * mat.trimEdge} × ${mat.sheetHeight - 2 * mat.trimEdge} мм пайдалы аймақ`,
        )
      }
      const last = groups[groups.length - 1]
      const prev = last?.[last.length - 1]
      // Тура көрші (үзіліссіз), бірдей биіктік/материал, парақтан аспайды.
      const contiguous = !!prev && prev.offset + widthOf(prev) === p.offset
      const sameSpec = !!last && h === groupHeight && !!mat && !!groupMat && mat.id === groupMat.id
      const fits = !!mat && fitsSheet(groupLength + widthOf(p), h, mat)
      if (contiguous && sameSpec && fits) {
        last!.push(p)
        groupLength += widthOf(p)
      } else {
        groups.push([p])
        groupLength = widthOf(p)
        groupHeight = h
        groupMat = mat
      }
    }

    for (const group of groups) {
      // Жалғыз модуль — бірігетін көршісі жоқ, бұрыннан дұрыс өз панелі қалады.
      if (group.length < 2) continue
      const start = group[0]!.offset
      const end = group[group.length - 1]!.offset + widthOf(group[group.length - 1]!)
      const span = end - start
      group.forEach((p, i) => {
        const c = byId.get(p.cabinetId)!
        const idx = indexOf.get(p.cabinetId)!
        out[idx] = {
          ...c,
          base: { ...c.base!, shared: true, ...(i === 0 ? { sharedSpan: span } : {}) },
        }
      })
    }
  }

  return out
}
