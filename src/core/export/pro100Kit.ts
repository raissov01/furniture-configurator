/**
 * PRO100 ТЕСТ-ЖИНАҒЫ (`pro100-test-kit.json`).
 *
 * PRO100-де скрипт API жоқ, сондықтан `tools/pro100-bridge` көпірі оны
 * интерфейсі арқылы басқарады: әр элементті кітапханадан АТЫ бойынша
 * тауып қояды, Properties-те H × W × D мен орнын жазады, содан кейін
 * PRO100 есептерін (деталь, элемент, материал, құн) сақтап, осы файлдағы
 * КҮТІЛГЕН мәндермен салыстырады. Күтілгені — біздің генератор шығарған
 * деталь тізімі, фурнитура, материал ауданы және баға.
 *
 * Төрт сценарий (тапсырмада берілген):
 *   1. төменгі 720 (H) × 600 (W) × 560 (D), 2 есік, 1 сөре;
 *   2. аспалы 720 (H) × 800 (W) × 300 (D), 2 есік (шаблонның 2 сөресі);
 *   3. ящикті төменгі 720 (H) × 600 (W) × 560 (D), 3 ящик;
 *   4. шағын ас үй: 3 төменгі + 3 аспалы, әрқайсысы 800 (W), қатар ені 2400.
 *
 * ⚠ PRO100 кітапханасының корпусы біздің конструкциядан басқа (цоколь,
 * столешница, фасад тереңдікке кіреді т.б.) — сондықтан айырма БОЛАДЫ.
 * Мақсат — айырманы «тең емес» деп қана емес, СЕБЕБІМЕН көру
 * (`pro100Audit.ts`).
 *
 * Таза TS (§3): файл жазу `src/cli/pro100Kit.ts`-те.
 */
import { generateCabinet } from '../generateCabinet'
import { generateHardware } from '../hardware'
import type { HardwarePlacement } from '../hardware'
import { projectUsage } from '../materialUsage'
import { nestPanels } from '../nesting'
import { priceProject } from '../pricing'
import { catalogOf, nestingOptionsOf } from '../shop'
import type { HardwareKind, ShopProfile } from '../shop'
import { findTemplate, templateToCabinet } from '../templates'
import type { CabinetConfig, Catalog, EdgeSpec, Panel, PanelRole } from '../types'
import { hardwareList } from './hardwareList'

export const PRO100_KIT_FORMAT = 'furniture-configurator.pro100-kit'
export const PRO100_KIT_NAME = 'pro100-test-kit'
/** PRO100-дан оқылған өлшемнің шегі, мм (тапсырма бойынша). */
export const PRO100_TOLERANCE = 0.5
/**
 * Аспалы шкафтың түбі еденнен, мм — ТЕК PRO100 сахнасында элементтерді
 * қабаттастырмай қою үшін (720 корпус + ~100 цоколь + ~40 столешница +
 * ~540 фартук). Өндірістік ереже ЕМЕС, деталь өлшеміне әсер етпейді.
 */
export const PRO100_WALL_BOTTOM = 1400

export type Pro100ItemKind = 'base' | 'wall' | 'drawers' | 'tall' | 'other'

export type Pro100KitItem = {
  id: string
  kind: Pro100ItemKind
  /** PRO100 Properties → Name өрісіне жазылатын ат */
  name: string
  /** Кітапханадан АТЫ бойынша табу: файл атауының нұсқалары, ретімен */
  library: { search: string[]; folderHints: string[] }
  height: number
  width: number
  depth: number
  /** PRO100 Properties → Position: Left / Bottom / Back, мм */
  position: { left: number; bottom: number; back: number }
  /** PRO100-да қойылатын материал атауы; null — кітапхана элементінікі қалады */
  material: string | null
  /** Біздің жақтағы конфигтің қысқаша сипаты (есепке) */
  ours: { templateId: string; doors: number; shelves: number; drawers: number; carcassMaterial: string }
}

export type Pro100ExpectedPart = {
  name: string
  role: PanelRole
  qty: number
  finishedLength: number
  finishedWidth: number
  cutLength: number
  cutWidth: number
  thickness: number
  material: string
  /** W1 + W2 кромкаларының қалыңдығы, мм — ҰЗЫНДЫҚТЫ қысқартатын (0.4-ті қоса) */
  edgeAlongLength: number
  /** L1 + L2 кромкаларының қалыңдығы, мм — ЕНДІ қысқартатын */
  edgeAlongWidth: number
}

export type Pro100ExpectedElement = { name: string; kind: HardwareKind; qty: number; unit: 'шт' | 'м' }
export type Pro100ExpectedMaterial = { name: string; thickness: number; areaMm2: number }
export type Pro100ExpectedCosts = {
  /** К ОПЛАТЕ, тиын */
  total: number
  goods: number
  services: number
  currency: '₸'
  /** Бағасы қойылмаған позициялар — бар болса құн салыстыруы шартты */
  missingPrices: string[]
}

export type Pro100Scenario = {
  id: string
  title: string
  items: Pro100KitItem[]
  expected: {
    parts: Pro100ExpectedPart[]
    elements: Pro100ExpectedElement[]
    materials: Pro100ExpectedMaterial[]
    costs: Pro100ExpectedCosts
  }
}

export type Pro100Kit = {
  format: typeof PRO100_KIT_FORMAT
  version: 1
  project: string
  tolerance: number
  units: 'mm'
  note: string
  scenarios: Pro100Scenario[]
}

// ── Сценарийлер ──────────────────────────────────────────────────────────────

type ItemSpec = {
  id: string
  kind: 'base' | 'wall' | 'drawers'
  templateId: string
  height: number
  width: number
  depth: number
  left: number
}

/** PRO100 кітапханасындағы атау нұсқалары (`docs/pro100/nomenclature.md` §2). */
function librarySearch(kind: ItemSpec['kind'], width: number, depth: number): Pro100KitItem['library'] {
  switch (kind) {
    case 'base':
      return { search: [`Н 2дв ${width}`, `Н2 ${width}`, `Н ${width}`], folderHints: ['Нижние', String(depth)] }
    case 'wall':
      return { search: [`В 2дв ${width}`, `В2 ${width}`, `В ${width}`], folderHints: ['Верхние', '720'] }
    case 'drawers':
      return { search: [`Н В3 ${width}`, `НВ3 ${width}`, `Н 3ящ ${width}`], folderHints: ['Нижние', String(depth)] }
  }
}

const KIND_RU: Record<ItemSpec['kind'], string> = { base: 'Нижний', wall: 'Верхний', drawers: 'Ящики' }

function scenarioSpecs(): { id: string; title: string; items: ItemSpec[] }[] {
  const kitchen: ItemSpec[] = []
  for (let i = 0; i < 3; i += 1) {
    kitchen.push({ id: `s4-base-${i + 1}`, kind: 'base', templateId: 'kitchen-base-600', height: 720, width: 800, depth: 560, left: i * 800 })
  }
  for (let i = 0; i < 3; i += 1) {
    kitchen.push({ id: `s4-wall-${i + 1}`, kind: 'wall', templateId: 'kitchen-wall-600', height: 720, width: 800, depth: 300, left: i * 800 })
  }
  return [
    {
      id: 's1-base-600',
      title: 'Нижний 720 (H) × 600 (W) × 560 (D): 2 двери, 1 полка',
      items: [{ id: 's1-base', kind: 'base', templateId: 'kitchen-base-600', height: 720, width: 600, depth: 560, left: 0 }],
    },
    {
      id: 's2-wall-800',
      title: 'Верхний 720 (H) × 800 (W) × 300 (D): 2 двери',
      items: [{ id: 's2-wall', kind: 'wall', templateId: 'kitchen-wall-600', height: 720, width: 800, depth: 300, left: 0 }],
    },
    {
      id: 's3-drawers-600',
      title: 'Нижний с ящиками 720 (H) × 600 (W) × 560 (D): 3 ящика',
      items: [{ id: 's3-drawers', kind: 'drawers', templateId: 'kitchen-base-drawers-600', height: 720, width: 600, depth: 560, left: 0 }],
    },
    {
      id: 's4-kitchen-2400',
      title: 'Кухня 2400 (W): 3 нижних + 3 верхних по 800 (W)',
      items: kitchen,
    },
  ]
}

function configOf(spec: ItemSpec, catalog: Catalog): CabinetConfig {
  const t = findTemplate(spec.templateId)
  if (!t) throw new Error(`PRO100 тест-жинағы: шаблон табылмады — ${spec.templateId}`)
  const config = templateToCabinet(t, catalog, { height: spec.height, width: spec.width, depth: spec.depth })
  return { ...config, id: spec.id, name: `${KIND_RU[spec.kind]} ${spec.width}` }
}

function summaryOf(config: CabinetConfig): { doors: number; shelves: number; drawers: number } {
  let doors = 0
  let shelves = 0
  let drawers = 0
  for (const s of config.sections) {
    if (s.fronts) doors += s.fronts.count
    for (const c of s.contents) {
      if (c.kind === 'shelves') shelves += c.count
      if (c.kind === 'drawers') drawers += c.count
    }
  }
  return { doors, shelves, drawers }
}

// ── Күтілген мәндер ─────────────────────────────────────────────────────────

function bandThickness(catalog: Catalog, e: EdgeSpec): number {
  if (!e) return 0
  const b = catalog.edgeBands.find((x) => x.id === e.bandId)
  if (!b) throw new Error(`Кромка табылмады: ${e.bandId}`)
  return b.thickness
}

/** Панельдер → PRO100 «Список деталей»-мен салыстыруға ыңғайлы жолдар. */
export function expectedParts(panels: Panel[], catalog: Catalog): Pro100ExpectedPart[] {
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const rows = new Map<string, Pro100ExpectedPart>()
  for (const p of panels) {
    const m = materials.get(p.materialId)
    if (!m) throw new Error(`Материал табылмады: ${p.materialId}`)
    // Кромка — физикалық тұрақты (0.4 мм болуы мүмкін), қосындыны 0.1-ге дөңгелектейміз.
    const alongLength = Math.round((bandThickness(catalog, p.edges.W1) + bandThickness(catalog, p.edges.W2)) * 10) / 10
    const alongWidth = Math.round((bandThickness(catalog, p.edges.L1) + bandThickness(catalog, p.edges.L2)) * 10) / 10
    const row: Pro100ExpectedPart = {
      name: p.label,
      role: p.role,
      qty: p.qty,
      finishedLength: p.finishedLength,
      finishedWidth: p.finishedWidth,
      cutLength: p.cutLength,
      cutWidth: p.cutWidth,
      thickness: m.thickness,
      material: m.name,
      edgeAlongLength: alongLength,
      edgeAlongWidth: alongWidth,
    }
    const key = [row.name, row.role, row.finishedLength, row.finishedWidth, row.cutLength, row.cutWidth, row.thickness, row.material].join('|')
    const found = rows.get(key)
    if (found) found.qty += row.qty
    else rows.set(key, row)
  }
  return [...rows.values()]
}

function expectedFor(configs: CabinetConfig[], shop: ShopProfile): Pro100Scenario['expected'] {
  const catalog = catalogOf(shop)
  const panels: Panel[] = []
  const placements: HardwarePlacement[] = []
  configs.forEach((config, i) => {
    // Бірнеше корпус бір жобада: панель id-і қайталанбауы үшін префикс.
    for (const p of generateCabinet(config, catalog)) panels.push({ ...p, id: `${i}:${p.id}` })
    placements.push(...generateHardware(config, catalog))
  })
  const hw = hardwareList(panels, placements, shop)
  const usage = projectUsage(panels, catalog)
  const price = priceProject(panels, nestPanels(panels, catalog, nestingOptionsOf(shop)), shop, placements)
  return {
    parts: expectedParts(panels, catalog),
    elements: hw.rows.map((r) => ({ name: r.name, kind: r.kind, qty: r.qty, unit: r.unit })),
    materials: usage.materials.map((m) => ({ name: m.materialName, thickness: m.thickness, areaMm2: m.area })),
    costs: {
      total: price.total,
      goods: price.goods,
      services: price.servicesTotal,
      currency: '₸',
      missingPrices: price.missingPrices,
    },
  }
}

/** Тест-жинақтың өзі. */
export function pro100TestKit(shop: ShopProfile): Pro100Kit {
  const catalog = catalogOf(shop)
  const scenarios: Pro100Scenario[] = scenarioSpecs().map((sc, si) => {
    const configs = sc.items.map((spec) => configOf(spec, catalog))
    const items: Pro100KitItem[] = sc.items.map((spec, i) => {
      const config = configs[i]!
      const carcass = catalog.materials.find((m) => m.id === config.carcassMaterialId)
      return {
        id: spec.id,
        kind: spec.kind,
        name: `S${si + 1} ${KIND_RU[spec.kind]} H${spec.height} W${spec.width} D${spec.depth}${sc.items.length > 1 ? ` #${i + 1}` : ''}`,
        library: librarySearch(spec.kind, spec.width, spec.depth),
        height: spec.height,
        width: spec.width,
        depth: spec.depth,
        position: { left: spec.left, bottom: spec.kind === 'wall' ? PRO100_WALL_BOTTOM : 0, back: 0 },
        material: null,
        ours: { templateId: spec.templateId, ...summaryOf(config), carcassMaterial: carcass?.name ?? config.carcassMaterialId },
      }
    })
    return { id: sc.id, title: sc.title, items, expected: expectedFor(configs, shop) }
  })
  return {
    format: PRO100_KIT_FORMAT,
    version: 1,
    project: PRO100_KIT_NAME,
    tolerance: PRO100_TOLERANCE,
    units: 'mm',
    note: 'Өлшем реті H × W × D, бүтін мм; ақша — тиын. PRO100 кітапхана элементі АТЫ бойынша ізделеді (library.search).',
    scenarios,
  }
}
