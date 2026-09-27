import { DEFAULT_SETTINGS, SHELF_PIN_DIAMETER } from '@/src/core/constants'
import type { ShopProfile } from '@/src/core/shop'
import type { ConstructionSettings } from '@/src/core/types'
import { parseNumberDraft } from './numberDraft'

export type DrillingNumericKey = { [K in keyof ConstructionSettings]: ConstructionSettings[K] extends number | null ? K : never }[keyof ConstructionSettings]

const FRACTIONAL = new Set<DrillingNumericKey>([
  'confirmatFaceDiameter', 'confirmatCountersinkDiameter', 'minifixSleeveDepth',
  'hingeFixingSpacing', 'hingeFixingOffset', 'hingeScrewPilotDiameter',
  'hingeScrewPilotDepth', 'hingePressFitDiameter', 'hingePressFitDepth',
])
const NULLABLE = new Set<DrillingNumericKey>([
  'minifixSleeveDepth', 'hingeScrewPilotDiameter', 'hingeScrewPilotDepth', 'hingePressFitDepth',
])
const POSITIVE = new Set<DrillingNumericKey>([
  'confirmatFaceDiameter', 'confirmatEdgeDepth', 'confirmatScrewLength',
  'hingeFixingSpacing', 'hingePressFitDiameter', 'minifixPairSpacing',
])

/** The shop profile can choose any of its bands for a cabinet's front edge. */
export function shelfPinOffsetMinimum(shop: ShopProfile): number {
  const threshold = shop.settings.minBandSubtract ?? DEFAULT_SETTINGS.minBandSubtract
  const band = Math.max(0, ...shop.edgeBands.map((item) => item.thickness >= threshold ? item.thickness : 0))
  return Math.ceil(SHELF_PIN_DIAMETER / 2 + band)
}

export function drillingSettingMinimum(key: DrillingNumericKey, shop: ShopProfile): number {
  if (key === 'shelfPinFrontOffset') return shelfPinOffsetMinimum(shop)
  if (key === 'shelfPinBackOffset') return Math.ceil(SHELF_PIN_DIAMETER / 2)
  if (NULLABLE.has(key)) return 0
  if (POSITIVE.has(key)) return FRACTIONAL.has(key) ? 0.1 : 1
  return 0
}

export function parseDrillingSettingDraft(key: DrillingNumericKey, raw: string, shop: ShopProfile):
  { value: number; error?: never } | { error: string; value?: never } {
  const min = drillingSettingMinimum(key, shop)
  const allowed = `${min}..4000 мм, ${FRACTIONAL.has(key) ? 'қадам 0.1' : 'бүтін'}`
  const result = parseNumberDraft(raw, { min, max: 4000, integer: !FRACTIONAL.has(key) })
  if (result.error || (result.value !== undefined && FRACTIONAL.has(key) &&
    Math.abs(result.value * 10 - Math.round(result.value * 10)) > 1e-8)) {
    return { error: `${key}: рұқсат етілгені ${allowed}` }
  }
  return { value: result.value! }
}
