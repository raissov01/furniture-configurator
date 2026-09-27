/**
 * Цех профилі — көп цехқа арналған жазылым (SaaS) үшін негіз.
 *
 * НЕГІЗГІ ЕРЕЖЕ: бір цехтың ақиқаты кодқа ЖАЗЫЛМАЙДЫ. Зазор, парақ форматы,
 * баға, фурнитура, сөре пролётінің шегі — бәрі осы профильде. Код тек
 * геометрияны біледі, ал «біздің цехта былай» дегеннің бәрі осында тұрады.
 * Сондықтан жаңа цех қосу үшін кодқа қол тигізудің қажеті жоқ.
 *
 * БАҒА. `defaultShopProfile()` — бағасыз каталог (бәрі 0). Жаңа цех
 * `starterShopProfile()`-пен ашылады: дерегі бар позициялар НАРЫҚ МЕДИАНАСЫМЕН
 * толады (`marketPrices.ts`, әр бағада белгі), дерегі жоқтары 0 қалады.
 * Бос бағамен `shopReadiness()` «КП шығаруға болмайды» деп тұрады.
 */

import { z } from 'zod'
import { migrateBandThreshold } from './migrateBandThreshold'
import { KERF, MAX_KERF } from './constants'
import { fillingHardware } from './filling'
import {
  HANDLE_BORE_SPACINGS, HandleModelSchema, HingeSystemSchema, defaultHandles,
  defaultHingeSystems, hingeBrandName,
} from './fittings'
import type { HandleModel, HingeSystem } from './fittings'
import type { NestingOptions, OptimizationLevel } from './nesting'
import { SEED_EDGE_BANDS, SEED_MATERIALS } from './seed'
import { EdgeBandSchema, MaterialSchema } from './schema'
import { capturePriceValues, syncActivePriceList } from './priceLists'
import {
  MARKET_MEDIAN_SOURCE, RECOMMENDED_PRICE_SOURCE, applyMarketDefaults, legacyMarkBasis, refreshMarketPrices,
  resetAllPositionsToMarket, resetPositionToMarket,
} from './marketPrices'
import type { MarketPriceMark, PriceKey } from './marketPrices'
import type { PriceList } from './priceLists'
import type { CabinetConfig, Catalog, EdgeBand, Material, Panel, SettingsOverride } from './types'

export type HardwareKind =
  | 'confirmat' | 'dowel' | 'minifix' | 'shelfPin' | 'hinge' | 'runner' | 'handle' | 'leg' | 'other'

export type HardwareItem = {
  id: string
  kind: HardwareKind
  name: string
  /** Бір дананың бағасы, ТИЫН. Float ЕШҚАШАН. */
  pricePerUnit: number
}

/** Жұмыс ақысы. Бәрі ТИЫНМЕН. Цех өз мөлшерлемесін өзі қояды. */
export type LabourRates = {
  /** Панель ауданының бір м²-і үшін (кесу + өңдеу) */
  perSquareMetre: number
  /** Бір бұрғылау тесігі үшін (присадка) */
  perHole: number
  /** Кромканың бір метрі үшін */
  perEdgeMetre: number
}

/**
 * Қызмет НЕГЕ қарап саналады.
 *
 * Бұл ӘДЕЙІ баптау: бір цех распилды ПАРАҚПЕН алады («парағы 2 000 ₸»),
 * екіншісі АУДАНМЕН («м² 500 ₸»), үшіншісі детальмен. Бір цехтың әдетін
 * бүкіл жүйеге жазсақ, қалғандарының сметасы жалған болып шығады.
 */
export type ServiceBasis = 'sheet' | 'squareMetre' | 'hole' | 'edgeMetre' | 'panel'

export type ServiceRate = {
  basis: ServiceBasis
  /** Бір бірліктің бағасы, ТИЫН. */
  rate: number
}

export type ServiceId = 'cutting' | 'drilling' | 'edging' | 'packing' | 'assembly'

export const SERVICE_IDS: ServiceId[] = ['cutting', 'drilling', 'edging', 'packing', 'assembly']

export const SERVICE_NAMES: Record<ServiceId, string> = {
  cutting: 'Распил',
  drilling: 'Присадка',
  edging: 'Облицовка кромкой',
  packing: 'Упаковка',
  assembly: 'Сборка',
}

export const SERVICE_BASIS_NAMES: Record<ServiceBasis, string> = {
  sheet: 'за лист',
  squareMetre: 'за м²',
  hole: 'за отверстие',
  edgeMetre: 'за метр кромки',
  panel: 'за деталь',
}

export type Services = Record<ServiceId, ServiceRate>

/**
 * «Парақ басы» қызметтері — `services`-тің ҮСТІНЕ қосылатын ҚОСЫМША баптау
 * (qdesign-дегі қаржы кестесі: распил/присадка/кромкалау — бір параққа).
 *
 * ⚠ §6 жұмыс ақысы моделі ӨЗГЕРМЕЙДІ: `services` бұрынғыдай есептеледі, ал
 * бұл баптау тек ҚОСЫМША жол береді. Әдепкі — баптау мүлде ЖОҚ (`undefined`)
 * немесе `enabled: false`, яғни смета бұрынғымен тиынға дейін бірдей.
 *
 * Парақ саны РАСКРОЙДАН алынады (нақты кеткен парақ), тақта (постформинг)
 * парақ емес — оған бұл қызметтер түспейді.
 */
export type SheetServiceId = 'cutting' | 'drilling' | 'edging'

export const SHEET_SERVICE_IDS: SheetServiceId[] = ['cutting', 'drilling', 'edging']

export const SHEET_SERVICE_NAMES: Record<SheetServiceId, string> = {
  cutting: 'Распил (за лист)',
  drilling: 'Присадка (за лист)',
  edging: 'Кромкование (за лист)',
}

/** Бір параққа мөлшерлеме, ТИЫН. 0 — осы қызмет алынбайды. */
export type SheetServiceRates = Record<SheetServiceId, number>

export type SheetServices = {
  enabled: boolean
  /** Барлық материалға ортақ мөлшерлеме. */
  rates: SheetServiceRates
  /**
   * Материал бойынша бөлек мөлшерлеме (мыс. 3 мм ХДФ-ті кесу арзан). Берілсе,
   * сол материалға `rates`-тің ОРНЫНА қолданылады.
   */
  byMaterial?: Record<string, SheetServiceRates> | undefined
}

/**
 * Монтаж. qdesign-дегідей: модуль ЕНІНІҢ бір метріне мөлшерлеме.
 * Бұл цехтың жұмысы емес, БӨЛЕК қызмет — сондықтан коэффициенттен тыс
 * қосылады (төмендегі `priceProject` түсініктемесін қара).
 */
export type Installation = {
  /** 1 метр еніне, ТИЫН. 0 — монтажсыз. */
  ratePerMetreWidth: number
}

/**
 * Раскрой баптаулары — цехтың СТАНОГЫ туралы, жобасы туралы емес.
 *
 * Пропил араның қалыңдығына, подрезка парақтың сапасына, іздеу тереңдігі
 * компьютердің шыдамына байланысты. Үшеуі де бір цехта бір рет қойылады да,
 * бүкіл жобаға қолданылады.
 */
export type CuttingSettings = {
  /** Пропил (араның жолы), мм. */
  kerf: number
  /**
   * Подрезка, мм. `null` — МАТЕРИАЛДАҒЫ `trimEdge` қалады: жаңа парақ пен
   * қоймадағы ескі парақтың шеті бірдей емес.
   */
  trimEdge: number | null
  optimization: OptimizationLevel
}

export function defaultCutting(): CuttingSettings {
  return { kerf: KERF, trimEdge: null, optimization: 'standard' }
}

/** Профильден раскройға берілетін баптаулар. */
export function nestingOptionsOf(shop: ShopProfile): NestingOptions {
  const cutting = shop.cutting ?? defaultCutting()
  return {
    kerf: cutting.kerf,
    optimization: cutting.optimization,
    ...(cutting.trimEdge === null ? {} : { trimEdge: cutting.trimEdge }),
  }
}

export function defaultServices(): Services {
  return {
    // Әдепкі негіздер — ең жиі кездесетіні; бағалары ӘРҚАШАН 0.
    cutting: { basis: 'sheet', rate: 0 },
    // Жаңа цехтың присадкасы ПАРАҚҚА (2026-09-27); бар цех өз бірлігінде қалады.
    drilling: { basis: 'sheet', rate: 0 },
    edging: { basis: 'edgeMetre', rate: 0 },
    packing: { basis: 'sheet', rate: 0 },
    assembly: { basis: 'squareMetre', rate: 0 },
  }
}

export type ShopProfile = {
  schemaVersion: 10
  id: string
  /** КП-да тұратын атау */
  name: string
  city: string
  phone: string

  /** Цех константалары. DEFAULT_SETTINGS үстіне жабылады (mergeSettings). */
  settings: SettingsOverride

  materials: Material[]
  edgeBands: EdgeBand[]
  hardware: HardwareItem[]
  /** Атаулы баға жиынтықтары; өндірістік сипаттамалар бұл тізімге кірмейді. */
  priceLists: PriceList[]
  /** Белсенді прайстың ақшасы жоғарыдағы material/hardware/service өрістерінде де тұр. */
  activePriceListId: string
  /**
   * Бағасы НАРЫҚТАН алынған позициялар (`material:<id>`, `edgeBand:<id>`,
   * `hardware:<id>`, `service:<id>`). Белгісі жоқ бағасы бар позиция — цехтың
   * өз бағасы; нарық жаңарғанда оған тимейміз.
   */
  marketPrices: Record<PriceKey, MarketPriceMark>
  /**
   * Ілгек жүйелері. Бренд ПРИСАДКАҒА әсер етеді (чашканың K өлшемі),
   * сондықтан бұл сметаның жолы емес, геометрияның кірісі.
   */
  hingeSystems: HingeSystem[]
  /** Тұтқа модельдері. Артикул мен баға — цехтың жеткізушісінен. */
  handles: HandleModel[]
  /**
   * ⚠ ЕСКІРГЕН (v3-ке дейінгі). Жаңа есеп `services`-пен жүреді; бұл өріс
   * ескі профильдерді оқу үшін ғана қалды әрі көшу кезінде `services`-ке
   * айналады.
   */
  labour: LabourRates
  /** Цехтың қызметтері. Әрқайсысының өз өлшем бірлігі бар. */
  services: Services
  /** Раскройдың станоктық баптаулары. */
  cutting: CuttingSettings
  installation: Installation
  /** Парақ басы ҚОСЫМША қызметтер. Жоқ болса — бұрынғы смета (жоғарыдағы түсінікті қара). */
  sheetServices?: SheetServices | undefined
  /**
   * Цехтың өз коэффициенті: материал + қызмет + фурнитура сомасы осыған
   * көбейеді. Монтаж бен үстеме бұған КІРМЕЙДІ.
   */
  coefficient: number
  /** Үстеме пайыз. КП-дағы соңғы сан осымен көбейеді. */
  markupPercent: number

  /**
   * ЛДСП сөренің шекті пролёті, мм. `null` — тексеру ӨШІРУЛІ.
   *
   * Әдепкі саны ӘДЕЙІ ЖОҚ. Ол материалға, қалыңдыққа, сөренің не көтеретініне
   * және цехтың тәжірибесіне байланысты. Бір цехтың санын бүкіл жүйеге жазсақ,
   * қалғандарына ол үнсіз ЖАЛҒАН ескерту болып шығады.
   */
  maxShelfSpan: number | null

  /**
   * Габариттің шектері, мм. Әр сан бөлек: `null` — сол жағынан шек ЖОҚ.
   *
   * НЕГЕ КЕРЕК. Цехтың станогы да, парағы да, көлігі де шексіз емес: 2900 мм
   * биік корпус қағазда әдемі, ал сол цехта ол ЖАСАЛМАЙДЫ. Шекті бір рет
   * қойған соң, менеджер қабылдамайтын тапсырысты клиентке уәде етпейді.
   *
   * ӘДЕПКІ МӘНІ — БАРЛЫҒЫ `null`, дәл `maxShelfSpan` сияқты. Бір цехтың
   * саны бүкіл жүйеге жазылса, қалғандарына ол үнсіз ЖАЛҒАН ескерту болып
   * шығады: 2750 мм — бәсекелестің әдепкісі, әмбебап шындық емес.
   *
   * Бұл — ЕСКЕРТУ, тыйым емес. Габаритті бәрібір теруге болады: цех өз
   * жауапкершілігімен шектен тыс корпус жасай алады (біреуін екіге бөліп,
   * бөлек жинап). Тыйым салсақ, құрал жұмысты тоқтатар еді.
   */
  limits: DimensionLimits
}

/**
 * Габарит шектері. Өріс аты — өлшемнің өзінде: H — биіктік, W — ені,
 * D — тереңдігі (жобаның H × W × D ережесі).
 */
export type DimensionLimits = {
  minHeight: number | null
  maxHeight: number | null
  minWidth: number | null
  maxWidth: number | null
  minDepth: number | null
  maxDepth: number | null
}

/** Шексіз профиль: жаңа цехта ешқандай габарит шегі жоқ. */
export function defaultLimits(): DimensionLimits {
  return {
    minHeight: null, maxHeight: null,
    minWidth: null, maxWidth: null,
    minDepth: null, maxDepth: null,
  }
}

/**
 * Наполнение механизмдері. ТЕХНИКА мұнда ЖОҚ: оны клиент өзі алады,
 * ал ойдан жазылған баға клиентке кеткен КП-ға түсер еді.
 */
const FILLING_HARDWARE: Omit<HardwareItem, 'pricePerUnit'>[] = fillingHardware()
  .map((f) => ({ id: f.id, kind: 'other' as const, name: f.name }))

/**
 * Ілгектің сметадағы позициясы брендпен де, жабылу түрімен де ерекшеленеді:
 * доводчикті Blum пен серіппесіз Boyard бір жолда тұра алмайды.
 */
const HINGE_HARDWARE: Omit<HardwareItem, 'pricePerUnit'>[] = defaultHingeSystems()
  .filter((sys) => sys.arm === 'cross' && sys.mount === 'overlay')
  .map((sys) => ({
    id: sys.hardwareId,
    kind: 'hinge' as const,
    name: `Петля ${hingeBrandName(sys.brand)} ${sys.closing === 'soft' ? 'с доводчиком' : 'без пружины'}`,
  }))

/** Қазақстан цехтары нақты сатып алатын позициялар. Бағалары 0 — цех толтырады. */
const SEED_HARDWARE: Omit<HardwareItem, 'pricePerUnit'>[] = [
  { id: 'confirmat-7x50', kind: 'confirmat', name: 'Конфирмат (евровинт) 7×50' },
  { id: 'confirmat-cap', kind: 'confirmat', name: 'Заглушка на конфирмат' },
  { id: 'dowel-8x30', kind: 'dowel', name: 'Шкант 8×30' },
  { id: 'minifix-15', kind: 'minifix', name: 'Стяжка эксцентриковая (минификс) 15 мм' },
  { id: 'shelf-pin-5', kind: 'shelfPin', name: 'Полкодержатель Ø5' },
  // Бренді көрсетілмеген жоба үшін жалпы позиция (ескі CLI осылай жүреді).
  { id: 'hinge-overlay', kind: 'hinge', name: 'Петля накладная Ø35 (без бренда)' },
  { id: 'hinge-plate', kind: 'hinge', name: 'Планка ответная под петлю' },
  { id: 'runner-roller-400', kind: 'runner', name: 'Направляющая роликовая 400 мм' },
  { id: 'runner-ball-400', kind: 'runner', name: 'Направляющая шариковая 400 мм' },
  // Тұтқалар: тізім `defaultHandles()`-тен шығады, сондықтан ҚОЛМЕН
  // қайталанбайды — жаңа модель қосқанда сметаның жолы да өзінен пайда болады.
  ...defaultHandles().map((h) => ({
    id: h.hardwareId,
    kind: 'handle' as const,
    name: h.kind === 'profile' ? `${h.name}, за метр` : h.name,
  })),
  { id: 'lift-flap', kind: 'other', name: 'Подъёмный механизм для фасада' },
  { id: 'leg-100', kind: 'leg', name: 'Ножка регулируемая 100 мм' },
  { id: 'leg-cone', kind: 'leg', name: 'Ножка коническая' },
  { id: 'leg-square', kind: 'leg', name: 'Ножка квадратная' },
  { id: 'leg-vector', kind: 'leg', name: 'Ножка «вектор» (наклонная)' },
  { id: 'leg-hidden', kind: 'leg', name: 'Опора скрытая под цоколь' },
  { id: 'runner-roller', kind: 'runner', name: 'Направляющие роликовые (пара)' },
  { id: 'runner-ball', kind: 'runner', name: 'Направляющие шариковые (пара)' },
  { id: 'runner-tandem', kind: 'runner', name: 'Направляющие Blum TANDEM (пара)' },
  { id: 'box-legrabox', kind: 'other', name: 'Ящик Blum LEGRABOX (комплект)' },
  { id: 'box-tandembox', kind: 'other', name: 'Ящик Blum TANDEMBOX (комплект)' },
  { id: 'box-merivobox', kind: 'other', name: 'Ящик Blum MERIVOBOX (комплект)' },
  { id: 'box-metabox', kind: 'other', name: 'Ящик Blum METABOX M (комплект)' },
  { id: 'box-metabox-n', kind: 'other', name: 'Ящик Blum METABOX N (комплект)' },
  { id: 'rod-25', kind: 'other', name: 'Штанга Ø25 (за метр)' },
  { id: 'rod-bracket', kind: 'other', name: 'Держатель штанги' },
  { id: 'sliding-track', kind: 'other', name: 'Рельс для дверей-купе (за метр)' },
  { id: 'sliding-kit', kind: 'other', name: 'Комплект профиля и роликов на дверь' },
  ...HINGE_HARDWARE,
  ...FILLING_HARDWARE,
]

/**
 * Парақтың стандарт форматтары, мм (ұзындық × ен).
 *
 * Бұлар — нарықтағы нақты форматтар, ойдан алынған сан емес: жеткізушіге
 * қарай әртүрлі болғандықтан, цех өз материалына керегін таңдайды.
 */
export const SHEET_FORMATS: { width: number; height: number; label: string }[] = [
  { width: 2800, height: 2070, label: '2800 × 2070 (Egger, Kronospan)' },
  { width: 2750, height: 1830, label: '2750 × 1830 (Kronospan RU)' },
  { width: 3660, height: 1830, label: '3660 × 1830' },
  { width: 2750, height: 1850, label: '2750 × 1850' },
  { width: 2440, height: 1830, label: '2440 × 1830' },
  { width: 2438, height: 1219, label: '2438 × 1219' },
  { width: 2800, height: 2100, label: '2800 × 2100' },
  { width: 2440, height: 2150, label: '2440 × 2150' },
]

/** Цех қоса алатын қалыңдықтар, мм. */
export const SHEET_THICKNESSES = [3, 4, 8, 10, 12, 16, 18, 19, 22, 25, 26] as const

/**
 * Цехтың өз материалы. Каталог цехтікі болғандықтан, оны толықтыру да
 * цехтың ісі: біз ойдан декор кітапханасын жаза алмаймыз — коды мен реңкі
 * жеткізушіден келеді.
 */
export function makeMaterial(input: {
  id: string
  name: string
  thickness: number
  sheetWidth: number
  sheetHeight: number
  hasGrain: boolean
  color: string
  edging?: { visibleFront: string | null; visibleSecondary: string | null } | undefined
}): Material {
  return {
    id: input.id,
    name: input.name,
    thickness: input.thickness,
    sheetWidth: input.sheetWidth,
    sheetHeight: input.sheetHeight,
    hasGrain: input.hasGrain,
    // Баға ӘРҚАШАН 0-ден басталады — ойдан жазылған баға КП-ға түседі.
    pricePerSheet: 0,
    trimEdge: 10,
    defaultEdging: {
      visibleFront: input.edging?.visibleFront ?? null,
      visibleSecondary: input.edging?.visibleSecondary ?? null,
      hidden: null,
    },
    decor: { color: input.color, kind: input.hasGrain ? 'wood' : 'solid' },
  }
}

/**
 * Каталогтағы материалды бөлек өңделетін жазба ретінде көшіру.
 * Бағасы, парақ/тақта өлшемі, кромка саясаты және декор сілтемесі дәл сақталады;
 * жаңа бағаны ойдан шығармаймыз. Ішкі объектілер де тәуелсіз көшіріледі.
 */
export function cloneMaterial(source: Material, existingIds: Iterable<string>): Material {
  const used = new Set(existingIds)
  const baseId = `${source.id}-copy`
  let id = baseId
  let number = 2
  while (used.has(id)) {
    id = `${baseId}-${number}`
    number += 1
  }

  return { ...structuredClone(source), id, name: `${source.name} (копия)` }
}

export function defaultHardware(): HardwareItem[] {
  return SEED_HARDWARE.map((h) => ({ ...h, pricePerUnit: 0 }))
}

/**
 * Жаңа цехтың бастапқы профилі. Каталог толық, бірақ бағасыз: цех бірінші
 * кіргенде тек бағаларын енгізсе жеткілікті, ештеңе құрастырудың қажеті жоқ.
 */
export function defaultShopProfile(id = 'shop-1'): ShopProfile {
  const base = {
    schemaVersion: 10 as const,
    id,
    name: '',
    city: '',
    phone: '',
    settings: {},
    materials: SEED_MATERIALS.map((m) => ({ ...m })),
    edgeBands: SEED_EDGE_BANDS.map((b) => ({ ...b })),
    hardware: defaultHardware(),
    hingeSystems: defaultHingeSystems(),
    handles: defaultHandles(),
    labour: { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 },
    services: defaultServices(),
    cutting: defaultCutting(),
    installation: { ratePerMetreWidth: 0 },
    coefficient: 1,
    markupPercent: 0,
    maxShelfSpan: null,
    limits: defaultLimits(),
    marketPrices: {},
  }
  return {
    ...base,
    activePriceListId: 'price-default',
    priceLists: [{ id: 'price-default', name: 'Основной', ...capturePriceValues(base) }],
  }
}

/**
 * ЖАҢА ЦЕХ осымен ашылады: каталог + нарық медианасы (дерегі барына ғана).
 * Цех бағасын өзгертсе, ол «өз бағасы» болады (`marketPrices.ts`).
 */
export function starterShopProfile(id = 'shop-1'): ShopProfile {
  return syncActivePriceList(applyMarketDefaults(defaultShopProfile(id)))
}

type PriceFields = Pick<ShopProfile, 'materials' | 'edgeBands' | 'hardware' | 'services' | 'installation'> & {
  priceLists?: PriceList[] | undefined
}

/**
 * Цехта бірде-бір баға жоқ па (материал, тақта, кромка, фурнитура, қызмет,
 * монтаж — ешбір прайс-парақта). Тек сондай ескі цех нарық бағасымен толады;
 * бір баға болса да, цех бағасын өзі жүргізеді — ештеңе ауыспайды.
 */
export function hasNoPrices(shop: PriceFields): boolean {
  const zero = (n: number | undefined) => (n ?? 0) === 0
  const current = shop.materials.every((m) => zero(m.pricePerSheet) && zero(m.slab?.pricePerMeter)) &&
    shop.edgeBands.every((b) => zero(b.pricePerMeter)) &&
    shop.hardware.every((h) => zero(h.pricePerUnit)) &&
    Object.values(shop.services).every((s) => zero(s.rate)) &&
    zero(shop.installation.ratePerMetreWidth)
  const lists = (shop.priceLists ?? []).every((l) =>
    Object.values(l.materialPrices).every((p) => zero(p.pricePerSheet) && zero(p.slabPricePerMeter)) &&
    Object.values(l.edgeBandPrices).every(zero) &&
    Object.values(l.hardwarePrices).every(zero) &&
    Object.values(l.serviceRates).every(zero) &&
    zero(l.installationRatePerMetreWidth))
  return current && lists
}

/** «Вернуть рекомендуемую / рыночную цену» — бір позиция. Белсенді прайс-парақ бірге жаңарады. */
export function resetToMarket(shop: ShopProfile, key: PriceKey): ShopProfile {
  const next = resetPositionToMarket(shop, key)
  return next === shop ? shop : syncActivePriceList(next)
}

/** «Вернуть все рыночные цены»: нарық дерегі бар барлық позиция. */
export function resetAllToMarket(shop: ShopProfile): ShopProfile {
  return syncActivePriceList(resetAllPositionsToMarket(shop))
}

/** Генерацияға керегі — материалдар мен кромкалар. Профильдің қалғаны кірмейді. */
export function catalogOf(shop: ShopProfile): Catalog {
  return {
    materials: shop.materials,
    edgeBands: shop.edgeBands,
    hingeSystems: shop.hingeSystems,
    handles: shop.handles,
  }
}

export type ReadinessIssue = {
  area: 'profile' | 'material' | 'edgeBand' | 'hardware'
  /** Қай жазба — материал id-і немесе өріс аты */
  id: string
  message: string
}

/**
 * Цех КП шығаруға дайын ба.
 *
 * `pricingReady` — тек ҚОЛДАНЫЛАТЫН материалдарға қарайды: каталогта 30 позиция
 * бар, ал цех оның бесеуімен ғана жұмыс істеуі мүмкін. Сондықтан тексеру
 * «бәрінің бағасы бар ма» емес, «осы жобаға керектерінің бағасы бар ма».
 */
export function shopReadiness(shop: ShopProfile, usedMaterialIds: string[] = []): {
  pricingReady: boolean
  issues: ReadinessIssue[]
} {
  const issues: ReadinessIssue[] = []

  if (shop.name.trim() === '') {
    issues.push({ area: 'profile', id: 'name', message: 'не заполнено название цеха — оно попадёт в КП' })
  }

  const used = new Set(usedMaterialIds)
  const scope = used.size > 0 ? shop.materials.filter((m) => used.has(m.id)) : shop.materials
  for (const m of scope) {
    if (m.pricePerSheet <= 0) {
      issues.push({ area: 'material', id: m.id, message: `${m.name}: не задана цена листа` })
    }
  }

  // Кромка бағасы тек нақты қолданылатындарға керек, бірақ қай кромка
  // қолданылатыны материалдың defaultEdging-інен шығады.
  const usedBands = new Set<string>()
  for (const m of scope) {
    for (const band of Object.values(m.defaultEdging ?? {})) {
      if (band) usedBands.add(band)
    }
  }
  for (const b of shop.edgeBands) {
    if (usedBands.has(b.id) && b.pricePerMeter <= 0) {
      issues.push({ area: 'edgeBand', id: b.id, message: `${b.name}: не задана цена за метр` })
    }
  }

  return { pricingReady: issues.every((i) => i.area === 'profile'), issues }
}

export type ShelfSpanWarning = { panelId: string; label: string; span: number; limit: number }

/**
 * Сөре тым ұзын ба. Цех шегін қоймаса — тексеру ЖҮРМЕЙДІ (бос тізім қайтады).
 * Бұл қате емес, ЕСКЕРТУ: цех өз жауапкершілігімен ұзын сөре қоя алады.
 */
export function shelfSpanWarnings(panels: Panel[], shop: ShopProfile): ShelfSpanWarning[] {
  const limit = shop.maxShelfSpan
  if (limit === null) return []
  return panels
    .filter((p) => p.role === 'shelf' && p.finishedLength > limit)
    .map((p) => ({ panelId: p.id, label: p.label, span: p.finishedLength, limit }))
}

export type DimensionWarning = {
  cabinetId: string
  cabinetName: string
  /** Қай өлшем: биіктік, ені, тереңдігі */
  axis: 'height' | 'width' | 'depth'
  /** Терілген сан */
  value: number
  /** Шектің өзі */
  limit: number
  /** Шектен ЖОҒАРЫ ма, әлде ТӨМЕН бе */
  side: 'min' | 'max'
}

export const DIMENSION_AXIS_LABEL: Record<DimensionWarning['axis'], string> = {
  height: 'Высота',
  width: 'Ширина',
  depth: 'Глубина',
}

/**
 * Ескертудің СӨЙЛЕМ ҮЛГІСІ, орындарымен.
 *
 * Дайын жол емес, үлгі қайтарылады: қазақшада сөз реті басқа («шектен АСЫП
 * КЕТТІ» соңында тұрады), сондықтан аударма бүтін сөйлемге жасалуы керек.
 * Ядро аударманы білмейді — оны UI (`tf`) толтырады.
 */
export function dimensionWarningTemplate(w: DimensionWarning): string {
  return w.side === 'max'
    ? '{axis} {value} мм — больше предела цеха ({limit} мм)'
    : '{axis} {value} мм — меньше предела цеха ({limit} мм)'
}

/** Аудармасыз, орысша мәтін: экспорт пен тест үшін. */
export function dimensionWarningText(w: DimensionWarning): string {
  return dimensionWarningTemplate(w)
    .replace('{axis}', DIMENSION_AXIS_LABEL[w.axis])
    .replace('{value}', String(w.value))
    .replace('{limit}', String(w.limit))
}

/**
 * Габарит цехтың шегінен шықты ма.
 *
 * Цех шек қоймаса — тексеру ЖҮРМЕЙДІ (бос тізім). Бұл `shelfSpanWarnings`
 * сияқты ЕСКЕРТУ: құрал жұмысты тоқтатпайды, тек «бұны сіздің цехта
 * жасай алмайсыз» деп ескертеді.
 *
 * Бір корпустан бірнеше ескерту шығуы мүмкін (ені де, биіктігі де асып кетсе):
 * менеджер қайсысын қысқарту керегін бірден көрсін.
 */
export function dimensionWarnings(
  cabinets: Pick<CabinetConfig, 'id' | 'name' | 'width' | 'height' | 'depth'>[],
  shop: ShopProfile,
): DimensionWarning[] {
  const { limits } = shop
  const out: DimensionWarning[] = []
  for (const c of cabinets) {
    const checks: { axis: DimensionWarning['axis']; value: number; min: number | null; max: number | null }[] = [
      { axis: 'height', value: c.height, min: limits.minHeight, max: limits.maxHeight },
      { axis: 'width', value: c.width, min: limits.minWidth, max: limits.maxWidth },
      { axis: 'depth', value: c.depth, min: limits.minDepth, max: limits.maxDepth },
    ]
    for (const ch of checks) {
      if (ch.max !== null && ch.value > ch.max) {
        out.push({ cabinetId: c.id, cabinetName: c.name, axis: ch.axis, value: ch.value, limit: ch.max, side: 'max' })
      }
      if (ch.min !== null && ch.value < ch.min) {
        out.push({ cabinetId: c.id, cabinetName: c.name, axis: ch.axis, value: ch.value, limit: ch.min, side: 'min' })
      }
    }
  }
  return out
}

// ── Сақтау схемасы ───────────────────────────────────────────────────────────
// Профиль серверде де, браузерде де осы пішінде сақталады. Ескі жазба
// сынбауы үшін `schemaVersion` бар — жоба файлындағыдай (§7).

const minorUnits = z.number().int().nonnegative()

export const ServiceRateSchema = z.object({
  basis: z.enum(['sheet', 'squareMetre', 'hole', 'edgeMetre', 'panel']),
  rate: z.number().min(0),
})

export const HardwareItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['confirmat', 'dowel', 'minifix', 'shelfPin', 'hinge', 'runner', 'handle', 'leg', 'other']),
  name: z.string().min(1),
  pricePerUnit: minorUnits,
})

const SettingsOverrideSchema = z.object({
  shelfGap: z.number().int().nonnegative(),
  shelfSetback: z.number().int().nonnegative(),
  plinthSetback: z.number().int().nonnegative(),
  frontGap: z.number().int().nonnegative(),
  backThickness: z.number().positive(),
  grooveDepth: z.number().int().nonnegative(),
  grooveInset: z.number().int().nonnegative(),
  minBandSubtract: z.number().int().min(1),
  confirmatSpanForThird: z.number().int().positive().nullable(),
  shelfPinDatum: z.number().int().nonnegative(),
  shelfPinFrontOffset: z.number().int().positive(),
  shelfPinBackOffset: z.number().int().positive(),
  confirmatFaceDiameter: z.number().positive(),
  confirmatEdgeDepth: z.number().int().positive(),
  confirmatScrewLength: z.number().int().positive(),
  confirmatCountersinkDiameter: z.number().nonnegative(),
  minifixBoltMount: z.enum(['screw-5', 'sleeve-8']),
  minifixSleeveDepth: z.number().positive().nullable(),
  hingeCupMount: z.enum(['cup-only', 'screw', 'press-fit']),
  hingeFixingSpacing: z.number().positive(),
  hingeFixingOffset: z.number().nonnegative(),
  hingeScrewPilotDiameter: z.number().positive().nullable(),
  hingeScrewPilotDepth: z.number().positive().nullable(),
  hingePressFitDiameter: z.number().positive(),
  hingePressFitDepth: z.number().positive().nullable(),
  runnerRollerHoleOffsets: z.array(z.number().int().positive()).min(1),
  runnerBallHoleOffsets: z.array(z.number().int().positive()).min(1),
  runnerTandemHoleOffsets: z.array(z.number().int().positive()).min(1),
  runnerRollerVerticalOffset: z.number().int().nonnegative(),
  runnerBallVerticalOffset: z.number().int().nonnegative(),
  runnerTandemVerticalOffset: z.number().int().nonnegative(),
  legCentreFromFront: z.number().int().nonnegative(),
  drawerFacadeScrewEndOffset: z.number().int().nonnegative(),
  minifixPairPlacement: z.enum(['center', 'ends']),
  minifixPairSpacing: z.number().int().positive(),
  minifixPairEndOffset: z.number().int().nonnegative(),
  outerFlipAxis: z.enum(['length', 'width']),
  slidingDoorOverlap: z.number().int().nonnegative(),
  slidingTrackTopSpace: z.number().int().nonnegative(),
  slidingTrackBottomSpace: z.number().int().nonnegative(),
  slidingProfileSide: z.number().int().nonnegative(),
  slidingProfileTopBottom: z.number().int().nonnegative(),
  drawerRunnerGap: z.number().int().nonnegative(),
  drawerBackGap: z.number().int().nonnegative(),
  drawerBoxDrop: z.number().int().nonnegative(),
}).partial()

const LabourRatesSchema = z.object({
  perSquareMetre: minorUnits,
  perHole: minorUnits,
  perEdgeMetre: minorUnits,
})

const CuttingSettingsSchema = z.object({
  kerf: z.number().int().nonnegative().max(MAX_KERF),
  trimEdge: z.number().int().nonnegative().max(200).nullable(),
  optimization: z.enum(['fast', 'standard', 'deep']),
})

const dimensionLimit = z.number().int().positive().nullable()

const DimensionLimitsSchema = z.object({
  minHeight: dimensionLimit,
  maxHeight: dimensionLimit,
  minWidth: dimensionLimit,
  maxWidth: dimensionLimit,
  minDepth: dimensionLimit,
  maxDepth: dimensionLimit,
})

const MarketPricesSchema = z.record(z.string(), z.object({
  // Ескі (v9 бастапқы) белгіде `source` жоқ — ол нарық медианасы.
  group: z.string().min(1).optional(),
  source: z.enum([RECOMMENDED_PRICE_SOURCE, MARKET_MEDIAN_SOURCE]).optional(),
  priceTiyn: minorUnits,
  dateSeen: z.string().min(1),
  offers: z.number().int().nonnegative(),
  marketMedianTiyn: minorUnits.optional(),
  basis: z.enum(['sheet', 'squareMetre', 'hole', 'edgeMetre', 'panel']).optional(),
}))

const PriceListSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  materialPrices: z.record(z.string(), z.object({
    pricePerSheet: minorUnits,
    slabPricePerMeter: minorUnits.optional(),
  })),
  edgeBandPrices: z.record(z.string(), minorUnits),
  hardwarePrices: z.record(z.string(), minorUnits),
  serviceRates: z.object({
    cutting: minorUnits,
    drilling: minorUnits,
    edging: minorUnits,
    packing: minorUnits,
    assembly: minorUnits,
  }),
  installationRatePerMetreWidth: minorUnits,
  coefficient: z.number().positive(),
  markupPercent: z.number().int().min(0).max(1000),
  marketPrices: MarketPricesSchema,
})

const SheetServiceRatesSchema = z.strictObject({
  cutting: minorUnits,
  drilling: minorUnits,
  edging: minorUnits,
})

export const SheetServicesSchema = z.strictObject({
  enabled: z.boolean(),
  rates: SheetServiceRatesSchema,
  byMaterial: z.record(z.string().min(1), SheetServiceRatesSchema).optional(),
})

export const ShopProfileSchema = z.object({
  schemaVersion: z.literal(10),
  id: z.string().min(1),
  name: z.string(),
  city: z.string(),
  phone: z.string(),
  settings: SettingsOverrideSchema,
  materials: z.array(MaterialSchema).min(1),
  edgeBands: z.array(EdgeBandSchema),
  hardware: z.array(HardwareItemSchema),
  priceLists: z.array(PriceListSchema).min(1),
  activePriceListId: z.string().min(1),
  hingeSystems: z.array(HingeSystemSchema),
  handles: z.array(HandleModelSchema),
  services: z.object({
    cutting: ServiceRateSchema,
    drilling: ServiceRateSchema,
    edging: ServiceRateSchema,
    packing: ServiceRateSchema,
    assembly: ServiceRateSchema,
  }),
  cutting: CuttingSettingsSchema,
  installation: z.object({ ratePerMetreWidth: minorUnits }),
  sheetServices: SheetServicesSchema.optional(),
  coefficient: z.number().positive(),
  labour: LabourRatesSchema,
  markupPercent: z.number().int().min(0).max(1000),
  maxShelfSpan: z.number().int().positive().nullable(),
  limits: DimensionLimitsSchema,
  marketPrices: MarketPricesSchema,
}).superRefine((shop, context) => {
  const ids = shop.priceLists.map((list) => list.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['priceLists'], message: 'прайс id қайталанады' })
  }
  if (!ids.includes(shop.activePriceListId)) {
    context.addIssue({ code: 'custom', path: ['activePriceListId'], message: 'белсенді прайс табылмады' })
  }
})

/**
 * v9 → v10: қызмет белгісіне сол кездегі бірлігін жазу; дереккөзі жоқ ескі
 * белгі — нарық медианасы. Баға мен қалғаны тимейді.
 */
function withMarkBasis(marks: unknown): unknown {
  if (marks === null || typeof marks !== 'object') return marks
  return Object.fromEntries(Object.entries(marks as Record<string, unknown>).map(([key, mark]) => {
    if (!key.startsWith('service:') || mark === null || typeof mark !== 'object') return [key, mark]
    const basis = legacyMarkBasis(key, mark as MarketPriceMark)
    return [key, { source: MARKET_MEDIAN_SOURCE, ...(mark as object), ...(basis === undefined ? {} : { basis }) }]
  }))
}

/** v6-ның өз өрістерін баға тізімін құрастырмай тұрып тексереміз. */
const ShopProfileV6Schema = z.object(ShopProfileSchema.shape)
  .omit({ priceLists: true, activePriceListId: true, marketPrices: true })
  .extend({ schemaVersion: z.literal(6) })

/**
 * Сақталған профильді оқу. Ескі нұсқа жаңасына КӨТЕРІЛЕДІ — цех бір рет
 * толтырған бағалары нұсқа ауысқанда жоғалмауы керек (§7).
 */
export function parseShopProfile(raw: unknown): ShopProfile {
  raw = migrateBandThreshold(raw).value
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion

  // v1 → v2: жұмыс ақысы мен үстеме пайда болды.
  let migrated: unknown = version === 1
    ? {
        ...(raw as object),
        schemaVersion: 2,
        labour: { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 },
        markupPercent: 0,
      }
    : raw

  // v2 → v3: ілгек жүйелері мен тұтқа модельдері. Ескі профильде олар жоқ,
  // сондықтан каталог та, оларға сәйкес сметалық позициялар да қосылады —
  // әйтпесе жоба ашылғанда фасад ілгексіз қалар еді.
  const v2 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v2 === 2) {
    const old = migrated as ShopProfile & { hardware: HardwareItem[] }
    const have = new Set(old.hardware.map((h) => h.id))
    const added = defaultHardware().filter((h) => !have.has(h.id))
    migrated = {
      ...old,
      schemaVersion: 3,
      hardware: [...old.hardware, ...added],
      hingeSystems: defaultHingeSystems(),
      handles: defaultHandles(),
    }
  }

  // v3 → v4: жұмыс ақысы ҚЫЗМЕТТЕРГЕ бөлінді. Ескі үш мөлшерлеме дәл сол
  // мағынасымен көшеді (аудан → распил, тесік → присадка, метр → кромка),
  // сондықтан цехтың бұрын енгізген сандары ЖОҒАЛМАЙДЫ.
  const v3 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v3 === 3) {
    const old = migrated as ShopProfile
    const labour = old.labour ?? { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 }
    migrated = {
      ...old,
      schemaVersion: 4,
      services: {
        cutting: { basis: 'squareMetre', rate: labour.perSquareMetre },
        drilling: { basis: 'hole', rate: labour.perHole },
        edging: { basis: 'edgeMetre', rate: labour.perEdgeMetre },
        packing: { basis: 'sheet', rate: 0 },
        assembly: { basis: 'squareMetre', rate: 0 },
      },
      installation: { ratePerMetreWidth: 0 },
      coefficient: 1,
    }
  }

  // v4 → v5: раскрой баптаулары. Ескі профильде олар жоқ, ал бұрынғы мінез —
  // дәл осы әдепкі сандар (пропил 4, материалдағы подрезка), сондықтан цехтың
  // ескі жобасы жаңа нұсқада басқаша кесілмейді.
  const v4 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v4 === 4) {
    migrated = { ...(migrated as ShopProfile), schemaVersion: 5, cutting: defaultCutting() }
  }

  // v5 → v6: габарит шектері. Ескі профильде олар жоқ, ал бұрынғы мінез —
  // ешқандай шек болмауы, сондықтан бос (`null`) шектермен көтеріледі: цехтың
  // ескі жобасы жаңа нұсқада кенет «шектен шықты» деп ескертілмейді.
  const v5 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v5 === 5) {
    migrated = { ...(migrated as ShopProfile), schemaVersion: 6, limits: defaultLimits() }
  }

  // v6 → v7: қазіргі нақты бағалар бірінші прайсқа түседі; бос/ойдан баға жоқ.
  const v6 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v6 === 6) {
    const old = ShopProfileV6Schema.parse(migrated)
    migrated = {
      ...old,
      schemaVersion: 7,
      activePriceListId: 'price-default',
      priceLists: [{ id: 'price-default', name: 'Основной', ...capturePriceValues(old) }],
    }
  }


  // v7 → v8: жаңа присадка мәндері `settings` ішіндегі override ретінде қалады.
  // Бұрын енгізілген параметрлер, каталог пен бағалар өзгермейді.
  const v7 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v7 === 7) {
    migrated = { ...(migrated as object), schemaVersion: 8 }
  }

  // v8 → v9: нарық белгілері. Ескі цехтың бағалары — ӨЗ бағасы (белгісіз).
  // Бағасы МҮЛДЕ бос цех ғана нарық медианасымен толады (төменде, тексерілген
  // соң): бір баға енгізген цехта ештеңе ауыспайды.
  const v8 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  const legacy = typeof v8 === 'number' && v8 <= 8
  if (v8 === 8) {
    const old = migrated as { priceLists?: unknown }
    migrated = {
      ...(migrated as object),
      schemaVersion: 9,
      marketPrices: {},
      priceLists: Array.isArray(old.priceLists)
        ? old.priceLists.map((list: unknown) => (list !== null && typeof list === 'object'
          ? { marketPrices: {}, ...(list as object) }
          : list))
        : old.priceLists,
    }
  }

  // v9 → v10: присадканың бірлігін цех таңдайды, жаңа цехта — парақ. Қызмет
  // белгісі енді бірлігін сақтайды: ескі белгіге сол кездегі бірлігі жазылады,
  // сондықтан бар цех (присадка тесікке) бағасымен де, бірлігімен де ҚАЛАДЫ.
  const v9 = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion
  if (v9 === 9) {
    const old = migrated as { marketPrices?: unknown; priceLists?: unknown }
    migrated = {
      ...(migrated as object),
      schemaVersion: 10,
      marketPrices: withMarkBasis(old.marketPrices),
      priceLists: Array.isArray(old.priceLists)
        ? old.priceLists.map((list: unknown) => (list !== null && typeof list === 'object'
          ? { ...(list as object), marketPrices: withMarkBasis((list as { marketPrices?: unknown }).marketPrices) }
          : list))
        : old.priceLists,
    }
  }

  // v3+ сақталған цехтарда жаңа inset артикулдары жоқ болуы мүмкін.
  // Тек жоқ ID-лер қосылады; цех өзі түзеткен жүйелер өзгермейді.
  const candidate = migrated as { hingeSystems?: unknown }
  if (candidate && Array.isArray(candidate.hingeSystems)) {
    const known = new Set(candidate.hingeSystems.map((system: unknown) =>
      system && typeof system === 'object' ? (system as { id?: unknown }).id : undefined))
    const added = defaultHingeSystems().filter((system) => system.mount === 'inset' && !known.has(system.id))
    if (added.length) migrated = { ...(migrated as object), hingeSystems: [...candidate.hingeSystems, ...added] }
  }

  const parsed = syncActivePriceList(ShopProfileSchema.parse(migrated) as ShopProfile)
  if (legacy && hasNoPrices(parsed)) return syncActivePriceList(applyMarketDefaults(parsed))
  // Нарық деректері жаңарса — тек белгісі бар позициялар жаңарады.
  return syncActivePriceList(refreshMarketPrices(parsed))
}
