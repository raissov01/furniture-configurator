/**
 * «Прайс-лист» докинг панелінің ТАЗА логикасы.
 *
 * Смета бетінің өзі толық дайын (`components/QuoteView.tsx`,
 * `src/core/pricing.ts`, `src/core/nesting.ts`) — бұл файл ЕШТЕҢЕ қайта
 * есептемейді, тек `priceProject`/`nestPanels` нәтижесін тар докинг панеліне
 * сыятын қысқа жолдарға тегістейді (QuoteView-дің толық кестесі қалқымалы
 * терезеге арналған, ал докинг панелі анағұрлым тар).
 */
// ⚠ салыстырмалы жол — `structureTree.ts`-тегі түсініктемені қара (vitest-те `@`-алиасы жоқ).
import type { NestingResult, PriceBreakdown, PriceLine } from '../../src/core/index'

export type MaterialSummaryRow = {
  materialId: string
  materialName: string
  sheets: number
  wastePercent: number
}

export function nestingSummary(nesting: NestingResult): MaterialSummaryRow[] {
  return nesting.byMaterial.map((m) => ({
    materialId: m.materialId,
    materialName: m.materialName,
    sheets: m.sheets.length,
    wastePercent: m.wastePercent,
  }))
}

export type PriceGroup = { title: string; lines: PriceLine[] }

/** Бос топты жасырып, тек нақты жолы бар топтарды қайтарады. */
export function priceGroups(price: PriceBreakdown, titles: {
  materials: string
  edges: string
  hardware: string
  manualItems?: string
  services: string
}): PriceGroup[] {
  return [
    { title: titles.materials, lines: price.materials },
    { title: titles.edges, lines: price.edges },
    { title: titles.hardware, lines: price.hardware },
    { title: titles.manualItems ?? 'Декор и техника', lines: price.manualItems },
    { title: titles.services, lines: price.services },
  ].filter((g) => g.lines.length > 0)
}

/** Толтырылмаған бағаны қайталанбайтын тізімге келтіреді (КП шығаруға болмайтынын түсіндіру үшін). */
export function uniqueMissingPrices(price: PriceBreakdown): string[] {
  return [...new Set(price.missingPrices)]
}
