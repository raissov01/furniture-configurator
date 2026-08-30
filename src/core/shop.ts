/**
 * Цех профилі — көп цехқа арналған жазылым (SaaS) үшін негіз.
 *
 * НЕГІЗГІ ЕРЕЖЕ: бір цехтың ақиқаты кодқа ЖАЗЫЛМАЙДЫ. Зазор, парақ форматы,
 * баға, фурнитура, сөре пролётінің шегі — бәрі осы профильде. Код тек
 * геометрияны біледі, ал «біздің цехта былай» дегеннің бәрі осында тұрады.
 * Сондықтан жаңа цех қосу үшін кодқа қол тигізудің қажеті жоқ.
 *
 * БАҒА. Барлық баға ӘДЕЙІ 0 күйінде келеді. Ойдан жазылған баға клиентке
 * кеткен КП-ға түседі, ал ол цехтың ақшасы (§6). Цех бағасын толтырғанша
 * `shopReadiness()` «КП шығаруға болмайды» деп тұрады.
 */

import { z } from 'zod'
import { SEED_EDGE_BANDS, SEED_MATERIALS } from './seed'
import type { Catalog, EdgeBand, Material, Panel, SettingsOverride } from './types'

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

export type ShopProfile = {
  schemaVersion: 2
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
  labour: LabourRates
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
}

/** Қазақстан цехтары нақты сатып алатын позициялар. Бағалары 0 — цех толтырады. */
const SEED_HARDWARE: Omit<HardwareItem, 'pricePerUnit'>[] = [
  { id: 'confirmat-7x50', kind: 'confirmat', name: 'Конфирмат (евровинт) 7×50' },
  { id: 'confirmat-cap', kind: 'confirmat', name: 'Заглушка на конфирмат' },
  { id: 'dowel-8x30', kind: 'dowel', name: 'Шкант 8×30' },
  { id: 'minifix-15', kind: 'minifix', name: 'Стяжка эксцентриковая (минификс) 15 мм' },
  { id: 'shelf-pin-5', kind: 'shelfPin', name: 'Полкодержатель Ø5' },
  { id: 'hinge-overlay', kind: 'hinge', name: 'Петля накладная Ø35, 4 отверстия' },
  { id: 'hinge-plate', kind: 'hinge', name: 'Планка ответная под петлю' },
  { id: 'runner-roller-400', kind: 'runner', name: 'Направляющая роликовая 400 мм' },
  { id: 'runner-ball-400', kind: 'runner', name: 'Направляющая шариковая 400 мм' },
  { id: 'handle-128', kind: 'handle', name: 'Ручка-скоба 128 мм' },
  { id: 'leg-100', kind: 'leg', name: 'Ножка регулируемая 100 мм' },
]

export function defaultHardware(): HardwareItem[] {
  return SEED_HARDWARE.map((h) => ({ ...h, pricePerUnit: 0 }))
}

/**
 * Жаңа цехтың бастапқы профилі. Каталог толық, бірақ бағасыз: цех бірінші
 * кіргенде тек бағаларын енгізсе жеткілікті, ештеңе құрастырудың қажеті жоқ.
 */
export function defaultShopProfile(id = 'shop-1'): ShopProfile {
  return {
    schemaVersion: 2,
    id,
    name: '',
    city: '',
    phone: '',
    settings: {},
    materials: SEED_MATERIALS.map((m) => ({ ...m })),
    edgeBands: SEED_EDGE_BANDS.map((b) => ({ ...b })),
    hardware: defaultHardware(),
    labour: { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 },
    markupPercent: 0,
    maxShelfSpan: null,
  }
}

/** Генерацияға керегі — материалдар мен кромкалар. Профильдің қалғаны кірмейді. */
export function catalogOf(shop: ShopProfile): Catalog {
  return { materials: shop.materials, edgeBands: shop.edgeBands }
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

// ── Сақтау схемасы ───────────────────────────────────────────────────────────
// Профиль серверде де, браузерде де осы пішінде сақталады. Ескі жазба
// сынбауы үшін `schemaVersion` бар — жоба файлындағыдай (§7).

const minorUnits = z.number().int().nonnegative()

export const HardwareItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['confirmat', 'dowel', 'minifix', 'shelfPin', 'hinge', 'runner', 'handle', 'leg', 'other']),
  name: z.string().min(1),
  pricePerUnit: minorUnits,
})

const EdgePolicySchema = z.object({
  visibleFront: z.string().nullable(),
  visibleSecondary: z.string().nullable(),
  hidden: z.string().nullable(),
})

const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  thickness: z.number().positive(),
  sheetWidth: z.number().int().positive(),
  sheetHeight: z.number().int().positive(),
  hasGrain: z.boolean(),
  pricePerSheet: minorUnits,
  trimEdge: z.number().int().nonnegative(),
  defaultEdging: EdgePolicySchema.optional(),
  decor: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    kind: z.enum(['solid', 'wood']),
  }).optional(),
})

const EdgeBandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  thickness: z.number().positive(),
  pricePerMeter: minorUnits,
})

const SettingsOverrideSchema = z.object({
  shelfGap: z.number().int().nonnegative(),
  shelfSetback: z.number().int().nonnegative(),
  frontGap: z.number().int().nonnegative(),
  backThickness: z.number().positive(),
  grooveDepth: z.number().int().nonnegative(),
  grooveInset: z.number().int().nonnegative(),
  minBandSubtract: z.number().nonnegative(),
  confirmatSpanForThird: z.number().int().positive(),
  shelfPinDatum: z.number().int().nonnegative(),
}).partial()

const LabourRatesSchema = z.object({
  perSquareMetre: minorUnits,
  perHole: minorUnits,
  perEdgeMetre: minorUnits,
})

export const ShopProfileSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  name: z.string(),
  city: z.string(),
  phone: z.string(),
  settings: SettingsOverrideSchema,
  materials: z.array(MaterialSchema).min(1),
  edgeBands: z.array(EdgeBandSchema),
  hardware: z.array(HardwareItemSchema),
  labour: LabourRatesSchema,
  markupPercent: z.number().int().min(0).max(1000),
  maxShelfSpan: z.number().int().positive().nullable(),
})

/**
 * Сақталған профильді оқу. Ескі нұсқа жаңасына КӨТЕРІЛЕДІ — цех бір рет
 * толтырған бағалары нұсқа ауысқанда жоғалмауы керек (§7).
 */
export function parseShopProfile(raw: unknown): ShopProfile {
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion
  const migrated =
    version === 1
      ? {
          ...(raw as object),
          schemaVersion: 2,
          labour: { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 },
          markupPercent: 0,
        }
      : raw
  return ShopProfileSchema.parse(migrated) as ShopProfile
}
