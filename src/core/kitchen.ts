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
import { defaultMillingSpec } from './milling'
import type { MillingPatternId } from './milling'
import { findTemplate, templateToCabinet } from './templates'
import { findFixture } from './filling'
import type { CabinetConfig, CabinetFixture, Catalog, Placement, Section } from './types'

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
const ROOM_MARGIN = 400

/**
 * Қабырға ұзындығын шкаф ЕНДЕРІНЕ бөлу.
 *
 * Мақсат — бәрі бірдей әрі ~600 мм-ге жақын: модуль саны ұзындыққа қарай
 * есептеледі, қалдық бірінші модульдерге бір миллиметрден таратылады
 * (қосынды ӘРҚАШАН дәл ұзындыққа тең — бұрыш пен столешница дәлме-дәл
 * отыруы үшін маңызды). Модуль [min,max] аралығынан шықпайды.
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

  const base = Math.floor(length / n)
  const remainder = Math.round(length) - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
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
const FRIDGE_WIDTH = 600
const SINK_WIDTH = 800
const TALL_HEIGHT = 2100
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
  const wantFridge = opts.appliances && opts.main && remaining >= APP_W + MODULE_MIN
  if (wantFridge) remaining -= APP_W
  const wantOven = opts.appliances && opts.main && remaining >= APP_W + MODULE_MIN
  if (wantOven) remaining -= APP_W
  const wantSink = !cornerSink && opts.sink && opts.main && remaining >= SINK_WIDTH + MODULE_MIN
  if (wantSink) remaining -= SINK_WIDTH
  const wantDish = opts.appliances && opts.main && (wantSink || cornerSink) && remaining >= APP_W + MODULE_MIN
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
 */
function applianceNiche(
  cabinet: CabinetConfig, contents: Section['contents'],
): CabinetConfig {
  return {
    ...cabinet,
    sections: cabinet.sections.map((sec, i) => (i === 0 ? { ...sec, contents, fronts: null } : sec)),
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
 * Төменгі модульді ТОЛЫҚ безендіру: цоколь + столешница + (қаласа) фартук,
 * материал мен фрезеровка. Шаблонда цоколь/столешница болса — сақталады.
 */
function dressLower(cabinet: CabinetConfig, opts: KitchenOptions): CabinetConfig {
  const dims = opts.dims
  const worktopMat = opts.materials?.worktopId
  const plinthMat = opts.materials?.plinthId ?? opts.materials?.frontId
  let out: CabinetConfig = {
    ...cabinet,
    base: {
      kind: 'plinth',
      height: dims?.plinthHeight ?? cabinet.base?.height ?? PLINTH_HEIGHT,
      ...(plinthMat ? { plinthMaterialId: plinthMat } : {}),
    },
    worktop: {
      overhangFront: dims?.worktopOverhang ?? cabinet.worktop?.overhangFront ?? WORKTOP_OVERHANG,
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
  const finishUpper = (c: CabinetConfig) => withMilling(withMaterials(c, options.materials), options.milling)
  const glassUpper = options.glassUpper ?? false
  const makeUpper = (width: number, uid: string): CabinetConfig => {
    let cab: CabinetConfig = { ...templateToCabinet(wallTpl, catalog, { width, height: upperH, depth: upperD }), id: uid }
    cab = handleAtBottom(cab, catalog)
    if (glassUpper) cab = withGlass(cab)
    if (options.ledUpper) cab = { ...cab, led: true }
    return finishUpper(cab)
  }

  const hobFuel = hobFuelOf(options)
  const runA = options.modules
    ? options.modules.runA
    : composeRun(options.lengthA, { sink, appliances, main: true, hob: hobFuel !== 'none', corner })
  // Қолмен берілген раскладкаға плита ӨЗДІГІНЕН қосылмайды: пайдаланушы
  // оны «Тумба под варочную панель» арқылы өзі қояды.
  const wantHob = hobFuel !== 'none' && !options.modules
  const runB = options.modules
    ? options.modules.runB
    : corner
      ? composeRun(options.lengthB!, { sink: false, appliances, main: false, hob: wantHob && !hasHob(runA) })
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
    const tower = () => ({ ...templateToCabinet(tplOf(mod.kind), catalog, { width: mod.width, height: TALL_HEIGHT, depth: TALL_DEPTH }), id })
    if (mod.kind === 'tall') {
      // Пенал (қойма бағанасы): толық биік, өз цоколі бар.
      return finishUpper(tower())
    }
    if (mod.kind === 'fridge') {
      // Тоңазытқыш бағанасы: ұя + үстінде кішкене шкаф.
      return finishUpper(applianceNiche(tower(), [
        { kind: 'appliance', appliance: 'fridge' },
        { kind: 'shelves', count: 1, shelfKind: 'adjustable' },
      ]))
    }
    if (mod.kind === 'oven') {
      // Духовка мұнарасы: духовка + СВЧ + сөрелер (qdesign «Пенал духовка+СВЧ»).
      return finishUpper(applianceNiche(tower(), [
        { kind: 'appliance', appliance: 'oven', height: 595 },
        { kind: 'appliance', appliance: 'microwave', height: 380 },
        { kind: 'shelves', count: 2, shelfKind: 'adjustable' },
      ]))
    }
    const base = { ...templateToCabinet(tplOf(mod.kind), catalog, { width: mod.width, height: lowerH, depth: lowerD }), id }
    if (mod.kind === 'dishwasher') {
      // Посудомойка: аласа ұя (фасады — техниканікі), цоколь + столешница астынан.
      return dressLower(applianceNiche(base, [{ kind: 'appliance', appliance: 'dishwasher', height: 600 }, { kind: 'empty' }]), options)
    }
    if (mod.kind === 'hob') {
      // Панельдің үстінде үстіңгі шкаф емес, СОРҒЫШ тұрады.
      let cab = withFixture(base, { kind: 'hob', fuel: hobFuel === 'electric' ? 'electric' : 'gas' })
      if (options.hood ?? true) cab = withFixture(cab, { kind: 'hood' })
      return dressLower(cab, options)
    }
    if (mod.kind === 'sink') return dressLower(withFixture(base, { kind: 'sink' }), options)
    if (mod.kind === 'cornerSink') {
      // Соқыр бұрыш `left` жақта: қатардың offset 0-і — дәл бұрыш, ал фронт.
      // панельдің `left`-і корпустың x = 0 жағына тұрады (generateCabinet).
      const blind: CabinetConfig = { ...base, frontPanel: { width: CORNER_BLIND, side: 'left' } }
      return dressLower(withFixture(blind, { kind: 'sink' }), options)
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
  const takesUpper = (kind: ModuleKind) =>
    withUpper && kind !== 'hob' && !MODULE_KINDS.some((m) => m.kind === kind && m.upper)

  // ── Негізгі қабырға (солтүстік), бұрыштан оңға (offset 0-ден) ─────────────
  let cursor = 0
  /*
   * Бұрыштағы модульдің ТЕРЕҢДІГІ: көрші қабырғаның қатары дәл одан кейін
   * басталады. Бұрын тұрақты `lowerD` еді — бұрышта пенал (560) тұрса, көрші
   * тумбаға 60 мм кіретін. Екі шеті де ескеріледі (П-пішінде батыс та бұрыш).
   */
  let depthAtStart = lowerD
  let depthAtEnd = lowerD
  runA.forEach((mod, i) => {
    const cab = build(mod, 'a')
    cabinets.push(cab)
    placements.push({ cabinetId: cab.id, wall: 'north', offset: cursor })
    if (i === 0) depthAtStart = cab.depth
    if (i === runA.length - 1) depthAtEnd = cab.depth
    if (takesUpper(mod.kind)) {
      const uid = nextId('a-up')
      let up = makeUpper(mod.width, uid)
      // Бұрыштық мойканың үстінде — бұрыштық үстіңгі: соқыр жағы да бұрышта.
      if (mod.kind === 'cornerSink') up = { ...up, frontPanel: { width: CORNER_UPPER_BLIND, side: 'left' } }
      cabinets.push(up)
      placements.push({ cabinetId: uid, wall: 'north', offset: cursor, elevation: upperElev })
    }
    cursor += mod.width
  })

  // ── Перпендикуляр қабырға (шығыс) ────────────────────────────────────────
  // Шығыстың offset 0-і ОҢТҮСТІК-ШЫҒЫС бұрышында, ал бізге СОЛТҮСТІК-ШЫҒЫС
  // керек: бұрыштан өлшенген `q`-ды offset-ке ауыстырамыз (depth − q − width).
  // Қатар мойка ТЕРЕҢДІГІНЕН басталады, әйтпесе бұрышта A-мен соқтығысады.
  let q = corner ? depthAtStart : 0
  runB.forEach((mod) => {
    const cab = build(mod.kind === 'tall' ? { kind: 'baseDoors', width: mod.width } : mod, 'b')
    cabinets.push(cab)
    placements.push({ cabinetId: cab.id, wall: 'east', offset: room.depth - q - mod.width })
    if (withUpper && mod.kind !== 'hob') {
      const uid = nextId('b-up')
      cabinets.push(makeUpper(mod.width, uid))
      placements.push({ cabinetId: uid, wall: 'east', offset: room.depth - q - mod.width, elevation: upperElev })
    }
    q += mod.width
  })

  // ── Үшінші қабырға (батыс, тек П-пішін) ──────────────────────────────────
  // Батыстың offset 0-і СОЛТҮСТІК-БАТЫС бұрышында, оңтүстікке қарай өседі.
  // Қатар мойка ТЕРЕҢДІГІНЕН басталады (солтүстікпен соқтығыспас үшін).
  let wOff = depthAtEnd
  runC.forEach((mod) => {
    const cab = build(mod.kind === 'tall' ? { kind: 'baseDoors', width: mod.width } : mod, 'c')
    cabinets.push(cab)
    placements.push({ cabinetId: cab.id, wall: 'west', offset: wOff })
    if (withUpper && mod.kind !== 'hob') {
      const uid = nextId('c-up')
      cabinets.push(makeUpper(mod.width, uid))
      placements.push({ cabinetId: uid, wall: 'west', offset: wOff, elevation: upperElev })
    }
    wOff += mod.width
  })

  return { cabinets, placements, room }
}
