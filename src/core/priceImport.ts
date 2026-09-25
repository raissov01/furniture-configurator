/** Цех CSV/XLSX прайсының дерек өзегі. Импорт алдын ала тексеріледі; еш баға үнсіз жазылмайды. */
import { unzipSync } from 'fflate'
import { ConfigValidationError } from './errors'
import { syncActivePriceList, switchPriceList } from './priceLists'
import type { ShopProfile } from './shop'
import type { OwnEdgeMeta, OwnMaterialMeta } from './data/catalog/schema'

export type PriceTable = { headers: string[]; rows: string[][] }
export type PriceColumnMap = {
  price: string; unit: string
  kind?: string; code?: string; name?: string; brand?: string; thickness?: string
  widthMm?: string; sheetWidth?: string; sheetHeight?: string
}
export type PriceTarget = {
  kind: 'material' | 'edgeBand' | 'hardware'; id: string; name: string
  code: string; aliases?: string[] | undefined; brand?: string | undefined; thickness?: number; widthMm?: number | undefined
  sheetWidth?: number; sheetHeight?: number; slab?: boolean
}
export type PriceMatch = { targetId: string; kind: PriceTarget['kind']; method: 'exact' | 'normalized' | 'similar'; confidence: number }
export type PricePreviewRow = {
  rowNumber: number; source: string[]; status: 'matched' | 'unmatched' | 'conflict'
  match?: PriceMatch; priceTiyn?: number; reason?: string
}
export type PricePreview = { rows: PricePreviewRow[]; counts: { matched: number; unmatched: number; conflict: number } }

const fail = (field: string, message: string, allowed?: string): never => { throw new ConfigValidationError(field, message, allowed) }
const textDecoder = new TextDecoder('utf-8', { fatal: true })

function csvTable(input: string): PriceTable {
  const source = input.replace(/^\uFEFF/, '')
  if (!source.trim()) return fail('file', 'CSV бос')
  const firstLine = source.split(/\r?\n/, 1)[0]!
  const delimiter = [';', ',', '\t'].map((d) => ({ d, n: firstLine.split(d).length - 1 }))
    .sort((a, b) => b.n - a.n)[0]!
  if (delimiter.n === 0) return fail('file', 'CSV бөлгіші табылмады', '; | , | Tab')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false, closed = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') { quoted = false; closed = true }
      else cell += ch
    } else if (ch === '"' && !cell && !closed) quoted = true
    else if (ch === delimiter.d || ch === '\n' || ch === '\r') {
      row.push(cell); cell = ''; closed = false
      if (ch !== delimiter.d) {
        if (row.some((v) => v.trim())) rows.push(row)
        if (rows.length > 20_001) return fail('file', 'CSV жол саны 20 000-нан асады')
        row = []
        if (ch === '\r' && source[i + 1] === '\n') i++
      }
    } else if (closed) return fail('file', `${rows.length + 1}-жолда тырнақшадан кейін артық таңба`)
    else cell += ch
  }
  if (quoted) return fail('file', 'CSV тырнақшасы жабылмаған')
  if (cell || row.length) { row.push(cell); if (row.some((v) => v.trim())) rows.push(row) }
  if (rows.length < 2) return fail('file', 'CSV-де тақырып пен кемінде бір дерек жолы болуы керек')
  return { headers: rows[0]!.map((v) => v.trim()), rows: rows.slice(1) }
}

const xmlUnescape = (s: string) => s.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (whole, numeric: string | undefined, named: string | undefined) => {
  if (numeric) return String.fromCodePoint(numeric[0] === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric))
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[named!] ?? whole
})
const attr = (tag: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1]
const xmlText = (body: string) => [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => xmlUnescape(m[1]!)).join('')
const zipEntry = (files: Record<string, Uint8Array>, path: string) => files[path] ? textDecoder.decode(files[path]) : undefined

function xlsxTable(bytes: Uint8Array, maxBytes: number, maxRows: number): PriceTable {
  if (bytes.length > maxBytes) return fail('file', `XLSX ${maxBytes} байт шегінен асады`)
  let files: Record<string, Uint8Array>
  let inflated = 0
  try {
    files = unzipSync(bytes, { filter: (file) => {
      if (!/^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[^/]+\.xml)$/.test(file.name)) return false
      inflated += file.originalSize
      if (inflated > maxBytes * 6) return fail('file', 'XLSX ішіндегі дерек шегінен асады')
      return true
    } })
  } catch (error) {
    if (error instanceof ConfigValidationError) throw error
    return fail('file', 'XLSX ZIP файлы бүлінген')
  }
  const workbook = zipEntry(files, 'xl/workbook.xml')
  const rels = zipEntry(files, 'xl/_rels/workbook.xml.rels')
  if (!workbook || !rels) return fail('file', 'XLSX жұмыс кітабы табылмады')
  const sheetTag = /<sheet\b[^>]*\br:id="([^"]+)"[^>]*\/?\s*>/.exec(workbook)
  if (!sheetTag) return fail('file', 'XLSX ішінде парақ жоқ')
  const relTag = [...rels.matchAll(/<Relationship\b[^>]*\/?\s*>/g)].find((m) => attr(m[0], 'Id') === sheetTag[1])?.[0]
  const target = relTag && attr(relTag, 'Target')
  if (!target || target.includes('..') || /^https?:/i.test(target)) return fail('file', 'XLSX парағының жолы жарамсыз')
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^xl\//, '')}`
  const sheet = zipEntry(files, sheetPath)
  if (!sheet) return fail('file', 'XLSX парағы табылмады')
  const stringsXml = zipEntry(files, 'xl/sharedStrings.xml') ?? ''
  const strings = [...stringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]!))
  const rows: string[][] = []
  for (const match of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    for (const cell of match[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cell[1]!, 'r')
      if (!ref) return fail('file', 'XLSX ұяшығында мекенжай жоқ')
      const letters = /^[A-Z]+/.exec(ref)?.[0]
      if (!letters) return fail('file', 'XLSX ұяшық мекенжайы жарамсыз')
      let index = 0
      for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64
      if (index > 100) return fail('file', 'XLSX баған саны 100-ден асады')
      const body = cell[2] ?? ''
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? ''
      const type = attr(cell[1]!, 't')
      cells[index - 1] = type === 's' ? strings[Number(value)] ?? '' : type === 'inlineStr' ? xmlText(body) : xmlUnescape(value)
    }
    if (cells.some((c) => c?.trim())) rows.push(Array.from({ length: cells.length }, (_, i) => cells[i] ?? ''))
    if (rows.length > maxRows + 1) return fail('file', `XLSX жол саны ${maxRows}-нан асады`)
  }
  if (rows.length < 2) return fail('file', 'XLSX ішінде тақырып пен дерек жолы жоқ')
  return { headers: rows[0]!.map((v) => v.trim()), rows: rows.slice(1) }
}

export function parsePriceFile(
  data: string | Uint8Array, format: 'csv' | 'xlsx',
  options: { csvEncoding?: 'utf-8' | 'windows-1251'; maxBytes?: number; maxRows?: number } = {},
): PriceTable {
  try {
    const maxBytes = options.maxBytes ?? 5_000_000
    const maxRows = options.maxRows ?? 20_000
    if (data.length > maxBytes) return fail('file', maxBytes === 5_000_000
      ? `${format.toUpperCase()} 5 МБ шегінен асады` : `${format.toUpperCase()} ${maxBytes} байт шегінен асады`)
    if (format === 'xlsx') {
      if (typeof data === 'string') return fail('file', 'XLSX байт ретінде берілуі керек')
      return xlsxTable(data, maxBytes, maxRows)
    }
    const decoder = options.csvEncoding === 'windows-1251' ? new TextDecoder('windows-1251') : textDecoder
    return csvTable(typeof data === 'string' ? data : decoder.decode(data))
  } catch (error) {
    if (error instanceof ConfigValidationError) throw error
    return fail('file', `${format.toUpperCase()} оқу мүмкін болмады`)
  }
}

export type PriceCode = { code: string; aliases?: string[]; brand?: string }

/** Өз каталогымыздың декор + құрылым кодын біріктіру. Жалаң декор коды балама ретінде сақталады. */
export function priceCodesFromOwnCatalog(
  materialMeta: Record<string, OwnMaterialMeta>, edgeMeta: Record<string, OwnEdgeMeta>,
): Record<string, PriceCode> {
  const codes: Record<string, PriceCode> = {}
  for (const [id, meta] of Object.entries(materialMeta)) {
    codes[id] = { code: `${meta.decorCode}${meta.structureCode ? ` ${meta.structureCode}` : ''}`,
      aliases: meta.structureCode ? [meta.decorCode] : [], brand: meta.manufacturer }
  }
  for (const [id, meta] of Object.entries(edgeMeta)) codes[id] = { code: meta.code, brand: meta.manufacturer }
  return codes
}

/** Декор коды каталог метасынан беріледі: атаудан код ойлап шығарылмайды. */
export function priceTargetsFromShop(shop: ShopProfile, codes: Record<string, PriceCode> = {}): PriceTarget[] {
  return [
    ...shop.materials.map((m): PriceTarget => ({ kind: 'material', id: m.id, name: m.name,
      code: codes[m.id]?.code ?? '', aliases: codes[m.id]?.aliases, brand: codes[m.id]?.brand, thickness: m.thickness,
      sheetWidth: m.sheetWidth, sheetHeight: m.sheetHeight, slab: !!m.slab })),
    ...shop.edgeBands.map((b): PriceTarget => ({ kind: 'edgeBand', id: b.id, name: b.name,
      code: codes[b.id]?.code ?? '', aliases: codes[b.id]?.aliases, brand: codes[b.id]?.brand, thickness: b.thickness, widthMm: b.widthMm })),
    ...shop.hardware.map((h): PriceTarget => ({ kind: 'hardware', id: h.id, name: h.name,
      code: codes[h.id]?.code ?? '', aliases: codes[h.id]?.aliases, brand: codes[h.id]?.brand })),
  ]
}

const normalized = (s: string) => s.normalize('NFKC').toLocaleUpperCase().replace(/[^A-ZА-ЯЁӘҒҚҢӨҰҮҺІ0-9]/g, '')
function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    previous.splice(0, previous.length, ...next)
  }
  return previous[b.length]!
}
function methodFor(source: string, target: string): PriceMatch['method'] | undefined {
  if (!source || !target) return undefined
  if (source === target) return 'exact'
  const a = normalized(source), b = normalized(target)
  if (a === b) return 'normalized'
  if (a.length >= 5 && b.length >= 5 && distance(a, b) === 1) return 'similar'
  return undefined
}
const confidence = { exact: 1, normalized: 0.95, similar: 0.8 }
const kindOf = (s: string): PriceTarget['kind'] | undefined => {
  const k = normalized(s)
  if (['МАТЕРИАЛ', 'ЛДСП', 'МДФ', 'ХДФ', 'MATERIAL', 'SHEET'].includes(k)) return 'material'
  if (['КРОМКА', 'ЛЕНТА', 'EDGEBAND', 'EDGE'].includes(k)) return 'edgeBand'
  if (['ФУРНИТУРА', 'HARDWARE', 'FITTING'].includes(k)) return 'hardware'
  return undefined
}
const integer = (s: string) => /^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined
function parseTiyn(s: string): number | undefined {
  const clean = s.trim().replace(/[\u00a0\u202f ]/g, '')
  const tiyn = /^(\d+)\s*тиын$/i.exec(s.trim())
  if (tiyn) return Number.isSafeInteger(Number(tiyn[1])) ? Number(tiyn[1]) : undefined
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(clean)
  if (!match) return undefined
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined
}
type Unit = 'sheet' | 'sqm' | 'lm' | 'piece'
const unitOf = (s: string): Unit | undefined => {
  const u = s.trim().toLocaleLowerCase().replace(/\s/g, '').replace(/^(₸|тг|kzt)\//, '')
  if (['парақ', 'лист', 'sheet', 'шт/лист'].includes(u)) return 'sheet'
  if (['м²', 'м2', 'sqm', 'кв.м', 'кв.м.'].includes(u)) return 'sqm'
  if (['п.м.', 'п.м', 'пм', 'м', 'lm', 'метр'].includes(u)) return 'lm'
  if (['дана', 'шт', 'шт.', 'piece', 'pcs'].includes(u)) return 'piece'
  return undefined
}
function converted(price: number, unit: Unit, target: PriceTarget): number | undefined {
  if (target.kind === 'material') {
    if (target.slab) return unit === 'lm' ? price : undefined
    if (unit === 'sheet') return price
    if (unit === 'sqm' && target.sheetWidth && target.sheetHeight)
      return Number((BigInt(price) * BigInt(target.sheetWidth) * BigInt(target.sheetHeight) + 500_000n) / 1_000_000n)
    return undefined
  }
  return target.kind === 'edgeBand' && unit === 'lm' || target.kind === 'hardware' && unit === 'piece' ? price : undefined
}

export function previewPriceImport(table: PriceTable, map: PriceColumnMap, targets: PriceTarget[]): PricePreview {
  if (!map.price?.trim()) return fail('columns.price', 'баға бағанын таңдаңыз')
  if (!map.unit?.trim()) return fail('columns.unit', 'өлшем бірлігі бағанын таңдаңыз')
  const used = Object.entries(map).filter(([, v]) => v !== undefined) as Array<[keyof PriceColumnMap, string]>
  if (!map.code && !map.name) return fail('columns', 'артикул/декор коды немесе атау бағаны керек')
  if (new Set(used.map(([, v]) => v)).size !== used.length) return fail('columns', 'баған сәйкестігі қайталанады')
  const indexes: Partial<Record<keyof PriceColumnMap, number>> = {}
  for (const [key, header] of used) {
    const index = table.headers.indexOf(header)
    if (index < 0 || table.headers.indexOf(header, index + 1) >= 0) return fail(`columns.${key}`, `"${header}" бағаны табылмады немесе тақырыпта қайталанды`)
    indexes[key] = index
  }
  const get = (row: string[], key: keyof PriceColumnMap) => row[indexes[key] ?? -1]?.trim() ?? ''
  const rows: PricePreviewRow[] = []
  for (let i = 0; i < table.rows.length; i++) {
    const source = table.rows[i]!
    const base: PricePreviewRow = { rowNumber: i + 2, source, status: 'unmatched' }
    const kindRaw = get(source, 'kind')
    const kind = kindRaw ? kindOf(kindRaw) : undefined
    if (kindRaw && !kind) { rows.push({ ...base, status: 'conflict', reason: 'санат белгісіз' }); continue }
    const code = get(source, 'code'), name = get(source, 'name'), brand = get(source, 'brand')
    const thicknessRaw = get(source, 'thickness'), thickness = thicknessRaw ? Number(thicknessRaw.replace(',', '.')) : undefined
    const widthRaw = get(source, 'widthMm'), widthMm = widthRaw ? integer(widthRaw) : undefined
    if (thicknessRaw && !(thickness! > 0) || widthRaw && !widthMm) { rows.push({ ...base, status: 'conflict', reason: 'қалыңдық/ені жарамсыз' }); continue }
    const candidates = targets.filter((t) => (!kind || t.kind === kind) &&
      (!brand || !t.brand || normalized(brand) === normalized(t.brand)) &&
      (thickness === undefined || t.thickness === thickness) &&
      (widthMm === undefined || t.widthMm === widthMm) &&
      (!get(source, 'sheetWidth') || t.sheetWidth === integer(get(source, 'sheetWidth'))) &&
      (!get(source, 'sheetHeight') || t.sheetHeight === integer(get(source, 'sheetHeight'))))
    const order = { exact: 3, normalized: 2, similar: 1 }
    const ranks = candidates.map((t) => ({ target: t,
      method: ([t.code, ...t.aliases ?? []].map((candidate) => methodFor(code || name, code ? candidate : t.name))
        .filter((m): m is PriceMatch['method'] => !!m).sort((a, b) => order[b] - order[a])[0]),
    }))
      .filter((v): v is { target: PriceTarget; method: PriceMatch['method'] } => !!v.method)
    const best = Math.max(0, ...ranks.map((r) => order[r.method]))
    const hits = ranks.filter((r) => order[r.method] === best)
    if (!hits.length) { rows.push({ ...base, reason: 'каталогта сәйкес код жоқ' }); continue }
    if (hits.length > 1) { rows.push({ ...base, status: 'conflict', reason: 'бірнеше нысана: қалыңдық/ені/парақ пішімін нақтылаңыз' }); continue }
    const hit = hits[0]!
    const amount = parseTiyn(get(source, 'price'))
    const unit = unitOf(get(source, 'unit'))
    const priceTiyn = amount && unit && converted(amount, unit, hit.target)
    if (!priceTiyn || !Number.isSafeInteger(priceTiyn)) {
      rows.push({ ...base, status: 'conflict', reason: 'баға немесе бірлік жарамсыз/түрлендірілмейді' }); continue
    }
    rows.push({ ...base, status: 'matched', priceTiyn,
      match: { targetId: hit.target.id, kind: hit.target.kind, method: hit.method, confidence: confidence[hit.method] } })
  }
  const byTarget = new Map<string, PricePreviewRow[]>()
  for (const row of rows) if (row.match) {
    const key = `${row.match.kind}:${row.match.targetId}`
    byTarget.set(key, [...byTarget.get(key) ?? [], row])
  }
  for (const duplicate of byTarget.values()) if (duplicate.length > 1) for (const row of duplicate) {
    row.status = 'conflict'; row.reason = 'бір нысанаға бірнеше прайс жолы'; delete row.match; delete row.priceTiyn
  }
  return { rows, counts: {
    matched: rows.filter((r) => r.status === 'matched').length,
    unmatched: rows.filter((r) => r.status === 'unmatched').length,
    conflict: rows.filter((r) => r.status === 'conflict').length,
  } }
}

/** Тек алдын ала көрінген нақты жолдар. Ұқсас код қолмен расталуы керек. */
export function applyPriceImport(shop: ShopProfile, preview: PricePreview, priceListId: string, approvedSimilarRows: number[] = []): ShopProfile {
  if (preview.counts.conflict) return fail('priceImport', 'қайшылықты жолдар бар; алдымен түзетіңіз')
  const approved = new Set(approvedSimilarRows)
  const active = shop.activePriceListId === priceListId ? shop : switchPriceList(shop, priceListId)
  const materials = active.materials.map((m) => ({ ...m, slab: m.slab && { ...m.slab } }))
  const edgeBands = active.edgeBands.map((b) => ({ ...b }))
  const hardware = active.hardware.map((h) => ({ ...h }))
  for (const row of preview.rows) {
    if (row.status !== 'matched' || !row.match || row.priceTiyn === undefined) continue
    if (row.match.method === 'similar' && !approved.has(row.rowNumber)) continue
    if (row.match.kind === 'material') {
      const m = materials.find((v) => v.id === row.match!.targetId)
      if (!m) return fail('priceImport', `материал табылмады: ${row.match.targetId}`)
      if (m.slab) m.slab.pricePerMeter = row.priceTiyn
      else m.pricePerSheet = row.priceTiyn
    } else if (row.match.kind === 'edgeBand') {
      const b = edgeBands.find((v) => v.id === row.match!.targetId)
      if (!b) return fail('priceImport', `кромка табылмады: ${row.match.targetId}`)
      b.pricePerMeter = row.priceTiyn
    } else {
      const h = hardware.find((v) => v.id === row.match!.targetId)
      if (!h) return fail('priceImport', `фурнитура табылмады: ${row.match.targetId}`)
      h.pricePerUnit = row.priceTiyn
    }
  }
  return syncActivePriceList({ ...active, materials, edgeBands, hardware })
}
