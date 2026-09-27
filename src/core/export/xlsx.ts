/**
 * XLSX экспорты (PHASE-2 A5). Кітапхана орнына минимал OOXML — бізге керегі
 * бірнеше парақ пен қалың тақырып жолы ғана, ал толық xlsx кітапханасы
 * бандлге жүздеген килобайт қосады.
 *
 * Жолдар inline string ретінде жазылады: sharedStrings кестесі керек емес.
 */

import { zipSync, strToU8 } from 'fflate'
import { CUT_LIST_COLUMNS, formatCutList } from '../cutList'
import type { Catalog, CutListRow, Panel } from '../types'
import type { SpecialPartRow } from '../specialParts'

/** 1980-01-01 00:00 UTC — ZIP форматындағы ең ерте жарамды күн. */
const FIXED_MTIME = Date.UTC(1980, 0, 1)

type Cell = { value: string | number; style?: number }
type Sheet = { name: string; rows: Cell[][] }

const STYLE_DEFAULT = 0
const STYLE_HEADER = 1
const STYLE_GROUP_CLIENT = 2
const STYLE_GROUP_SHOP = 3
const STYLE_TOTAL = 4

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function columnName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function sheetXml(sheet: Sheet): string {
  const rows = sheet.rows.map((cells, r) => {
    const inner = cells.map((cell, c) => {
      const ref = `${columnName(c)}${r + 1}`
      const style = cell.style ? ` s="${cell.style}"` : ''
      if (typeof cell.value === 'number') {
        return `<c r="${ref}"${style}><v>${cell.value}</v></c>`
      }
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${inner}</row>`
  }).join('')

  const widths = Array.from({ length: sheet.rows[1]?.length ?? 10 }, (_, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 22 : 13}" customWidth="1"/>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${widths}</cols><sheetData>${rows}</sheetData></worksheet>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF7A3E00"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8E8E8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD6EAF8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDEBD0"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function buildWorkbook(sheets: Sheet[]): Uint8Array {
  const sheetEntries = sheets.map((s, i) => ({ ...s, file: `sheet${i + 1}.xml`, id: i + 1 }))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetEntries.map((s) => `<Override PartName="/xl/worksheets/${s.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetEntries.map((s) => `<sheet name="${escapeXml(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetEntries.map((s) => `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${s.file}"/>`).join('')}
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/styles.xml': strToU8(STYLES_XML),
  }
  for (const s of sheetEntries) files[`xl/worksheets/${s.file}`] = strToU8(sheetXml(s))

  // mtime бекітілген: бірдей конфиг бірдей байт берсін (diff пен тест үшін).
  // ZIP форматы 1980-нен ерте күнді қабылдамайды, сондықтан дәл 1980-01-01.
  return zipSync(files, { level: 6, mtime: FIXED_MTIME })
}

/** Excel парағының атына болмайтын таңбалар және 31 таңба шегі. */
function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Лист'
  let candidate = base
  let i = 2
  while (used.has(candidate)) {
    const suffix = ` ${i++}`
    candidate = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(candidate)
  return candidate
}

/**
 * Бір парақты қарапайым кесте: бірінші жол — қалың тақырып. Сандар САН болып
 * жазылады (Базис-Раскройдың Excel импорты бағанды санмен оқиды).
 */
export function simpleTableXlsx(sheetName: string, header: string[], rows: (string | number)[][]): Uint8Array {
  return buildWorkbook([{
    name: safeSheetName(sheetName, new Set()),
    rows: [
      header.map((value) => ({ value, style: STYLE_HEADER })),
      ...rows.map((r) => r.map((value) => ({ value }))),
    ],
  }])
}

/**
 * Деталировка: ӘР МАТЕРИАЛҒА БІР ПАРАҚ, соңында қорытынды жол.
 * Тақырыпта ГОТОВЫЙ (клиент) мен РЕЗ (цех) бағандары бөлек түспен.
 */
export function cutListToXlsx(panels: Panel[], catalog: Catalog, projectName: string,
  specialParts: readonly SpecialPartRow[] = []): Uint8Array {
  const rows = formatCutList(panels, catalog)
  const byMaterial = new Map<string, CutListRow[]>()
  for (const row of rows) {
    const list = byMaterial.get(row.material) ?? []
    list.push(row)
    byMaterial.set(row.material, list)
  }

  const used = new Set<string>()
  const sheets: Sheet[] = []
  for (const [material, materialRows] of byMaterial) {
    const header: Cell[] = CUT_LIST_COLUMNS.map((c) => ({
      value: c.group ? `${c.group.split(' · ')[0]}: ${c.header}` : c.header,
      style: c.audience === 'client' ? STYLE_GROUP_CLIENT
        : c.group === 'РЕЗ · цех' ? STYLE_GROUP_SHOP
          : STYLE_HEADER,
    }))

    const body: Cell[][] = materialRows.map((r) =>
      CUT_LIST_COLUMNS.map((c) => ({ value: r[c.key] })),
    )

    const pieces = materialRows.reduce((s, r) => s + r.qty, 0)
    const areaM2 = materialRows.reduce(
      (s, r) => s + (r.cutLength * r.cutWidth * r.qty) / 1_000_000, 0,
    )
    const total: Cell[] = CUT_LIST_COLUMNS.map((c, i) => {
      if (i === 0) return { value: 'ИТОГО', style: STYLE_TOTAL }
      if (c.key === 'qty') return { value: pieces, style: STYLE_TOTAL }
      if (c.key === 'note') return { value: `${areaM2.toFixed(2)} м² по резу`, style: STYLE_TOTAL }
      return { value: '', style: STYLE_TOTAL }
    })

    sheets.push({
      name: safeSheetName(material, used),
      rows: [
        [{ value: projectName, style: STYLE_HEADER }],
        header,
        ...body,
        total,
      ],
    })
  }

  for (const section of ['Токарлық бұйым', 'Иілген деталь'] as const) {
    const parts = specialParts.filter((part) => part.section === section)
    if (!parts.length) continue
    const headers = section === 'Токарлық бұйым'
      ? ['Наименование', 'Материал', 'Высота, мм', 'Макс. диаметр, мм', 'Кол-во', 'Операция', 'Цена/шт, тиын']
      : ['Наименование', 'Материал', 'Развёртка, мм', 'Высота, мм', 'Радиус, мм', 'Угол, °', 'Кол-во', 'Операция', 'Цена/шт, тиын']
    const body: Cell[][] = parts.map((part) => (section === 'Токарлық бұйым'
      ? [part.name, part.materialName, part.height, part.maxDiameter ?? '', part.quantity, part.operation, part.unitPrice]
      : [part.name, part.materialName, part.developedLength ?? '', part.height, part.radius ?? '',
        part.angleDegrees ?? '', part.quantity, part.operation, part.unitPrice]
    ).map((value) => ({ value })))
    sheets.push({ name: safeSheetName(section, used), rows: [
      [{ value: projectName, style: STYLE_HEADER }],
      headers.map((value) => ({ value, style: STYLE_HEADER })),
      ...body,
    ] })
  }

  // Присадка бөлек парақта: цехта оны бөлек адам оқиды.
  const drillRows: Cell[][] = [[
    { value: 'Деталь', style: STYLE_HEADER },
    { value: 'Сторона', style: STYLE_HEADER },
    { value: 'X', style: STYLE_HEADER },
    { value: 'Y', style: STYLE_HEADER },
    { value: 'Ø', style: STYLE_HEADER },
    { value: 'Глубина', style: STYLE_HEADER },
    { value: 'Назначение', style: STYLE_HEADER },
  ]]
  for (const p of panels) {
    for (const d of p.drilling) {
      drillRows.push([
        { value: p.label }, { value: d.face }, { value: d.x }, { value: d.y },
        { value: d.diameter }, { value: d.depth }, { value: d.purpose },
      ])
    }
  }
  if (drillRows.length > 1) sheets.push({ name: safeSheetName('Присадка', used), rows: drillRows })

  return buildWorkbook(sheets)
}
