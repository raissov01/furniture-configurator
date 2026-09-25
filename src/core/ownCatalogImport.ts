/** Цех экспорттаған Базис Excel-ін алдын ала көру. Кіріс дерегі ортақ каталогқа жазылмайды. */
import { ConfigValidationError } from './errors'
import { parsePriceFile } from './priceImport'
import type { PriceTable } from './priceImport'
import type { Material, EdgeBand } from './types'

export type BasisColumnMap = {
  articul: string; name: string; group: string; thickness: string
  length: string; width: string; stepX: string; stepY: string
}
export const DEFAULT_BASIS_COLUMNS: BasisColumnMap = {
  articul: 'Артикул материала', name: 'Наименование материала', group: 'Наименование группы',
  thickness: 'Толщина', length: 'Длина', width: 'Ширина', stepX: 'Шаг по Х', stepY: 'Шаг по Y',
}
export type ImportError = { rowNumber: number; reason: string }
export type BasisPreview = { materials: Material[]; edgeBands: EdgeBand[]; errors: ImportError[]; skipped: number }

const slug = (value: string) => value.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]+/gu, '-').replace(/^-|-+$/g, '')
const integer = (value: string) => /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
const thicknessOf = (value: string) => Number(value.trim().replace(',', '.'))
const wood = /(?:^|[^\p{L}])(дуб|ясень|сосна|орех|вяз|бук|кл[её]н|бер[её]за|каштан|тик|палисандр|венге|дерево|вуд|кедр|вишня)[\p{L}]*/iu

export function previewBasisTable(table: PriceTable, map: BasisColumnMap = DEFAULT_BASIS_COLUMNS): BasisPreview {
  for (const key of Object.keys(DEFAULT_BASIS_COLUMNS) as Array<keyof BasisColumnMap>) {
    if (typeof map?.[key] !== 'string' || !map[key].trim()) throw new ConfigValidationError(`columns.${key}`, 'Баған атауы қажет')
  }
  const columns = Object.entries(map) as [keyof BasisColumnMap, string][]
  if (columns.length !== Object.keys(DEFAULT_BASIS_COLUMNS).length) throw new ConfigValidationError('columns', 'Баған картасында артық өріс бар')
  if (new Set(columns.map(([, name]) => name)).size !== columns.length) throw new ConfigValidationError('columns', 'Баған сәйкестігі қайталанады')
  const indexes = Object.fromEntries(columns.map(([key, name]) => {
    const index = table.headers.indexOf(name)
    if (index < 0 || table.headers.indexOf(name, index + 1) >= 0) throw new ConfigValidationError(`columns.${key}`, `Баған табылмады немесе қайталанды: ${name}`)
    return [key, index]
  })) as Record<keyof BasisColumnMap, number>
  const materials: Material[] = [], edgeBands: EdgeBand[] = [], errors: ImportError[] = []
  const ids = new Set<string>()
  let skipped = 0
  table.rows.forEach((row, index) => {
    const get = (key: keyof BasisColumnMap) => (row[indexes[key]] ?? '').trim()
    const group = get('group'), name = get('name'), category = /(?:^|\/)ЛДСП(?:\/|$)/iu.test(group) ? 'ldsp'
      : /(?:^|\/)ХДФ(?:\/|$)/iu.test(group) ? 'hdf'
      : /кромочн|кромка/iu.test(group) ? 'edge' : null
    if (!category || category === 'ldsp' && !name.includes(',')) { skipped++; return }
    const rowNumber = index + 2
    const articul = get('articul'), thickness = thicknessOf(get('thickness'))
    const id = `shop-basis-${category}-${slug(articul)}`
    if (!articul || !name || !Number.isFinite(thickness) || thickness <= 0 || !slug(articul)) {
      errors.push({ rowNumber, reason: 'Артикул, атау немесе қалыңдық жарамсыз' }); return
    }
    if (ids.has(id)) { errors.push({ rowNumber, reason: 'Артикул қайталанған' }); return }
    if (category === 'ldsp' && ![16, 18].includes(thickness) ||
        category === 'hdf' && ![3, 4].includes(thickness) ||
        category === 'edge' && ![0.4, 1, 2].includes(thickness)) {
      errors.push({ rowNumber, reason: 'Қалыңдық Базис импортында қолдау таппайды' }); return
    }
    if (category === 'edge') {
      const width = /\d+(?:[,.]\d+)?\s*[xх×]\s*(\d{2,3})\b/iu.exec(name)
      if (!width) { errors.push({ rowNumber, reason: 'Кромка ені атаудан табылмады' }); return }
      if (![19, 22].includes(Number(width[1]))) { errors.push({ rowNumber, reason: 'Кромка ені 19 немесе 22 мм болуы керек' }); return }
      edgeBands.push({ id, name, thickness, widthMm: Number(width[1]), pricePerMeter: 0 })
    } else {
      let sheetWidth = integer(get('length')), sheetHeight = integer(get('width'))
      if (!(sheetWidth > 0 && sheetHeight > 0)) {
        const x = integer(get('stepX')), y = integer(get('stepY'))
        sheetWidth = Math.max(x, y); sheetHeight = Math.min(x, y)
        if (!(sheetWidth >= 1500 && sheetHeight >= 1500)) {
          errors.push({ rowNumber, reason: 'Парақ өлшемі жарамсыз: Length/Width және Step X/Y нақты емес' }); return
        }
      }
      if (!Number.isSafeInteger(sheetWidth) || !Number.isSafeInteger(sheetHeight)) {
        errors.push({ rowNumber, reason: 'Парақ өлшемі бүтін мм болуы керек' }); return
      }
      const manufacturer = group.split('/')[2] ?? ''
      const egger = manufacturer === 'Egger' ? /\b([HUW])\d{3,5}\b/i.exec(name) : null
      materials.push({ id, name, thickness, sheetWidth, sheetHeight,
        hasGrain: category === 'hdf' ? false : egger ? egger[1]?.toUpperCase() === 'H' : !/дублин/iu.test(name) && wood.test(name),
        pricePerSheet: 0, trimEdge: 10 })
    }
    ids.add(id)
  })
  return { materials, edgeBands, errors, skipped }
}

export function parseBasisExcel(bytes: Uint8Array, map: BasisColumnMap = DEFAULT_BASIS_COLUMNS): BasisPreview {
  // 2023All сияқты үлкен экспорт үшін 50 000 жол; ZIP ашылған көлемі бөлек шектеледі.
  return previewBasisTable(parsePriceFile(bytes, 'xlsx', { maxBytes: 10_000_000, maxRows: 50_000 }), map)
}
