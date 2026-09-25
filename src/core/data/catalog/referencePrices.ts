/**
 * «Анықтамалық (жеткізуші)» прайс-парағы: ҚР жеткізушілерінің АШЫҚ бағалары
 * (`.codex-runs/pricing-research/suppliers.json` → `input/supplierPrices.json`)
 * өз каталогымыздың материалы/кромкасымен байланады.
 *
 * Бұл баға `Material.pricePerSheet`-ке ЖАЗЫЛМАЙДЫ: ол бір жеткізушінің бір
 * күнгі бағасы, цехтың сатып алу бағасы емес. Цех оны бағдар ретінде көреді
 * де, өз бағасын өзі бекітеді (seed.ts, §6 — ойдан жазылған баға КП-ға түспейді).
 *
 * Байланыс ережесі — ТЕК дәл сәйкестік: бренд = өндіруші, декор коды (+құрылым),
 * қалыңдық, парақ форматы. Бренді не декор коды жоқ жол ешнәрсеге жалғанбайды.
 */
import type { EdgeBand, Material } from '../../types'
import type { OwnEdgeMeta, OwnMaterialMeta } from './schema'

export const REFERENCE_PRICE_LIST_NAME = 'Анықтамалық (жеткізуші)'

/** `suppliers.json` жолының бізге керек бөлігі (өріс атаулары дереккөздегідей). */
export type SupplierPriceRow = {
  supplier: string
  city: string
  url: string
  date_seen: string
  brand: string | null
  decor_code: string | null
  name: string
  thickness_mm: number | null
  sheet_size_mm: string | null
  unit: string
  price_kzt: number | null
  vat_included: boolean | 'unknown'
  note: string
  category: string
  price_type: 'exact' | 'from' | 'on_request' | 'not_published'
}

export type ReferencePrice = {
  targetKind: 'material' | 'edgeBand'
  targetId: string
  supplier: string
  city: string
  url: string
  dateSeen: string
  unit: 'sheet' | 'lm'
  /** Бүтін тиын (теңге × 100). Валюта айырбасталмайды. */
  priceTiyn: number
  priceType: 'exact' | 'from'
  vatIncluded: boolean | 'unknown'
  supplierName: string
  supplierDecorCode: string
}

/** Жеткізуші бренд атауын өндіруші атауына келтіру (тек бір бренд екі жазылуы). */
const BRAND_ALIASES: Record<string, string> = {
  'ультрадекор': 'ultradecor',
  'увадрев-холдинг': 'увадрев',
}

/** Жеткізуші санаты → біздің плита түрі. Басқа санат (столешница, қызмет) байланбайды. */
const CATEGORY_KIND: Record<string, OwnMaterialMeta['kind']> = { ldsp: 'ldsp', mdf: 'mdf', hdf: 'hdf' }

/**
 * Өндірушінің СТАНДАРТ өнім желісі: жеткізуші тек «ЛДСП» деп жазса (ылғалға
 * төзімді деп көрсетпесе), сатылатыны — осы желі. Egger: E1E05 P2 — EN 312
 * бойынша құрғақ бөлмеге арналған жиһаз плитасы; MR-FSTAR — ылғалға төзімді
 * (P3), жеткізуші оны атауында бөлек атайды.
 */
export const STANDARD_PRODUCT_LINE: Record<string, string> = { egger: 'P2' }

/** Жеткізуші атауында ылғалға төзімділік белгісі (қаз./орыс.). */
const MOISTURE_RE = /ылғал|влаг/i

const brandKey = (s: string) => {
  const low = s.trim().toLowerCase()
  return BRAND_ALIASES[low] ?? low
}
const code = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase()

/** "2800×2070" → [2800, 2070]; басқа пішім → null. */
export function parseSheetSize(s: string | null): [number, number] | null {
  if (s === null) return null
  const m = /^(\d+)\s*[×xх*]\s*(\d+)$/.exec(s.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

/** Кромка жолының енін ескертпеден/атаудан оқу: «19/0,4», «22/1». */
export function parseEdgeWidth(row: SupplierPriceRow): number | null {
  const m = /(\d{2})\s*\/\s*\d/.exec(`${row.name} ${row.note}`)
  return m ? Number(m[1]) : null
}

/**
 * Өндіруші декорға бірнеше «ұсынылған» құрылым жариялаған жағдайда (Увадрев)
 * біздің жазбада құрылым null. Жеткізуші кодында құрылым тұрса («U 9118 TS»),
 * декор коды дәл сол әрі қалғаны тек құрылым пішіні (1–3 әріп, бір цифр) болса
 * ғана сәйкес: «U9118» + «TS». «U91181» сияқты басқа код сәйкес келмейді.
 */
function sameDecorAnyStructure(supplierCode: string, decor: string): boolean {
  if (supplierCode === decor) return true
  return supplierCode.startsWith(decor) && /^[A-Z]{1,3}\d?$/.test(supplierCode.slice(decor.length))
}

const priced = (r: SupplierPriceRow): r is SupplierPriceRow & { price_kzt: number; price_type: 'exact' | 'from' } =>
  r.price_kzt !== null && Number.isInteger(r.price_kzt) && r.price_kzt > 0 &&
  (r.price_type === 'exact' || r.price_type === 'from')

export function linkReferencePrices(
  rows: SupplierPriceRow[],
  materials: Material[],
  materialMeta: Record<string, OwnMaterialMeta>,
  edgeBands: EdgeBand[],
  edgeMeta: Record<string, OwnEdgeMeta>,
): ReferencePrice[] {
  const out: ReferencePrice[] = []
  const base = (r: SupplierPriceRow & { price_kzt: number; price_type: 'exact' | 'from' }) => ({
    supplier: r.supplier, city: r.city, url: r.url, dateSeen: r.date_seen,
    priceTiyn: r.price_kzt * 100, priceType: r.price_type, vatIncluded: r.vat_included,
    supplierName: r.name, supplierDecorCode: r.decor_code ?? '',
  })

  for (const r of rows) {
    if (!priced(r) || r.brand === null || r.decor_code === null || r.thickness_mm === null) continue
    const brand = brandKey(r.brand)
    const supplierCode = code(r.decor_code)

    if (r.unit === 'sheet') {
      const size = parseSheetSize(r.sheet_size_mm)
      const kind = CATEGORY_KIND[r.category]
      if (size === null || kind === undefined) continue
      let hits = materials.filter((m) => {
        const meta = materialMeta[m.id]
        if (!meta || meta.kind !== kind || brandKey(meta.manufacturer) !== brand) return false
        const full = code(meta.decorCode) + (meta.structureCode === null ? '' : code(meta.structureCode))
        const codeOk = supplierCode === full || (meta.structureCode === null && sameDecorAnyStructure(supplierCode, code(meta.decorCode)))
        const sizeOk = (m.sheetWidth === size[0] && m.sheetHeight === size[1]) ||
          (m.sheetWidth === size[1] && m.sheetHeight === size[0])
        return codeOk && m.thickness === r.thickness_mm && sizeOk
      })
      const standard = STANDARD_PRODUCT_LINE[brand]
      if (hits.length > 1 && standard !== undefined && !MOISTURE_RE.test(`${r.name} ${r.note}`)) {
        hits = hits.filter((m) => materialMeta[m.id]?.productLine === standard)
      }
      // Бір жолдың бір ғана нысанасы болуы керек — екіұшты байланыс жасалмайды.
      const hit = hits[0]
      if (hits.length === 1 && hit) out.push({ targetKind: 'material', targetId: hit.id, unit: 'sheet', ...base(r) })
    } else if (r.unit === 'lm') {
      const width = parseEdgeWidth(r)
      if (width === null) continue
      const hits = edgeBands.filter((b) => {
        const meta = edgeMeta[b.id]
        return meta !== undefined && brandKey(meta.manufacturer) === brand && code(meta.code) === supplierCode &&
          b.thickness === r.thickness_mm && meta.widthMm === width
      })
      const hit = hits[0]
      if (hits.length === 1 && hit) out.push({ targetKind: 'edgeBand', targetId: hit.id, unit: 'lm', ...base(r) })
    }
  }
  return out
}
