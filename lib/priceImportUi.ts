import type { PriceColumnMap, PricePreview } from '@/src/core/priceImport'

const headings: Record<keyof PriceColumnMap, string[]> = {
  kind: ['санат', 'категория', 'kind', 'type'],
  code: ['артикул', 'код', 'sku', 'code'],
  name: ['атау', 'наименование', 'название', 'name'],
  brand: ['бренд', 'производитель', 'brand'],
  thickness: ['қалыңдық', 'толщина', 'thickness'],
  widthMm: ['ені', 'ширина кромки', 'widthmm'],
  sheetWidth: ['ширина листа', 'sheetwidth'],
  sheetHeight: ['высота листа', 'sheetheight'],
  price: ['баға', 'цена', 'price'],
  unit: ['бірлік', 'ед. изм.', 'единица', 'unit'],
}

export function defaultPriceColumnMap(headers: string[]): Partial<PriceColumnMap> {
  const result: Partial<PriceColumnMap> = {}
  const used = new Set<string>()
  for (const key of Object.keys(headings) as Array<keyof PriceColumnMap>) {
    const header = headers.find((h) => !used.has(h) && headings[key].includes(h.trim().toLowerCase()))
    if (header) { result[key] = header; used.add(header) }
  }
  return result
}

export function canApplyPricePreview(counts: PricePreview['counts']): boolean {
  return counts.matched > 0 && counts.conflict === 0
}
