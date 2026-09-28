import { nestPanels, nestingOptionsOf, priceProject } from '../src/core/index'
import type { Catalog, HardwarePlacement, ManualPriceItem, Panel, PriceOverrides, ShopProfile, SpecialPartRow } from '../src/core/index'

/** Toolbar, КП және келісім диалогы бір өндірістік есепті оқиды. */
export function approvalPrice(
  panels: Panel[], catalog: Catalog, shop: ShopProfile,
  hardware: HardwarePlacement[], moduleWidths: number[], overrides: PriceOverrides,
  manualItems: ManualPriceItem[] = [],
  specialParts: readonly SpecialPartRow[] = [],
): { kind: 'ready'; total: number } | { kind: 'missing' } {
  const nesting = nestPanels(panels, catalog, nestingOptionsOf(shop))
  const price = priceProject(panels, nesting, shop, hardware, moduleWidths, overrides, manualItems, specialParts)
  return price.missingPrices.length > 0 ? { kind: 'missing' } : { kind: 'ready', total: price.total }
}

const MONEY_ALLOWED = '0..90071992547409.91 ₸, екі ондыққа дейін'

/** Өріс тек дәл тиынға келетін мәтінді қабылдайды; бос және артық бөлшек өзгеріс жазбайды. */
export function parseTengeInput(raw: string): { ok: true; minor: number } | { ok: false; allowed: string } {
  if (!/^(?:0|[1-9]\d*)(?:[.,]\d{1,2})?$/.test(raw)) return { ok: false, allowed: MONEY_ALLOWED }
  const [whole, fraction = ''] = raw.replace(',', '.').split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? { ok: true, minor } : { ok: false, allowed: MONEY_ALLOWED }
}

export function parsePercentInput(raw: string): { ok: true; value: number } | { ok: false; allowed: string } {
  const allowed = '0..100 %'
  if (!/^(?:0|[1-9]\d*)(?:[.,]\d+)?$/.test(raw)) return { ok: false, allowed }
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) && value <= 100 ? { ok: true, value } : { ok: false, allowed }
}

export function parseCoefficientInput(raw: string): { ok: true; value: number } | { ok: false; allowed: string } {
  const allowed = '> 0'
  if (!/^(?:0|[1-9]\d*)(?:[.,]\d+)?$/.test(raw)) return { ok: false, allowed }
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? { ok: true, value } : { ok: false, allowed }
}
