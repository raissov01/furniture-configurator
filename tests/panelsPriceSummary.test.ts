/**
 * ПРАЙС-ЛИСТ докинг панелінің таза логикасы
 * (`components/panels/priceSummary.ts`). Нақты `priceProject`/`nestPanels`
 * есептеуін ЕМЕС, тек нәтижені жолдарға тегістеуді тексереді — есептің
 * дұрыстығын `src/core/pricing.ts`/`nesting.ts`-тің өз тесттері қорғайды.
 */
import { describe, expect, it } from 'vitest'
import type { NestingResult, PriceBreakdown, PriceLine } from '../src/core/index'
import { nestingSummary, priceGroups, uniqueMissingPrices } from '../components/panels/priceSummary'

const nesting: NestingResult = {
  sheetCount: 3,
  unplaced: [],
  byMaterial: [
    {
      materialId: 'm1', materialName: 'ЛДСП Белый', wastePercent: 12.345,
      sheets: [{} as never, {} as never],
    } as unknown as NestingResult['byMaterial'][number],
  ],
}

const line = (id: string, name: string, cost: number): PriceLine => ({
  id, name, qty: 1, unit: 'шт', unitPrice: cost, cost,
})

describe('nestingSummary', () => {
  it('sheets.length-ті парақ санына айналдырады, wastePercent-ті сақтайды', () => {
    const rows = nestingSummary(nesting)
    expect(rows).toEqual([{ materialId: 'm1', materialName: 'ЛДСП Белый', sheets: 2, wastePercent: 12.345 }])
  })
})

describe('priceGroups', () => {
  const titles = { materials: 'Материалы', edges: 'Кромка', hardware: 'Фурнитура', services: 'Услуги цеха' }

  it('бос топтарды сүзеді', () => {
    const price = {
      materials: [line('a', 'Материал А', 100)],
      edges: [],
      hardware: [],
      manualItems: [],
      services: [line('s', 'Распил', 50)],
      missingPrices: [],
    } as unknown as PriceBreakdown
    const groups = priceGroups(price, titles)
    expect(groups.map((g) => g.title)).toEqual(['Материалы', 'Услуги цеха'])
    expect(groups[0]!.lines).toHaveLength(1)
  })

  it('бәрі бос болса — бос тізім', () => {
    const price = { materials: [], edges: [], hardware: [], manualItems: [], services: [], missingPrices: [] } as unknown as PriceBreakdown
    expect(priceGroups(price, titles)).toEqual([])
  })
})

describe('uniqueMissingPrices', () => {
  it('қайталанатын жолды бір рет қайтарады', () => {
    const price = { missingPrices: ['ЛДСП Белый', 'ЛДСП Белый', 'ПВХ 2 мм'] } as unknown as PriceBreakdown
    expect(uniqueMissingPrices(price)).toEqual(['ЛДСП Белый', 'ПВХ 2 мм'])
  })
})
