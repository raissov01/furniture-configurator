/**
 * Бирка (этикетка) — детальге жабыстырылатын қағаз.
 *
 * Цехта раскройдан кейін бірдей түсті, бірдей қалыңдықтағы жүздеген деталь
 * үйіліп қалады. Оларды ажырататын жалғыз нәрсе — үстіндегі бирка. Сондықтан
 * биркада ҚҰРАСТЫРУШЫҒА керегінің бәрі тұруы керек: позиция нөмірі
 * (деталировкадағы жолмен БІР), детальдің аты, рез өлшемі, дайын өлшемі,
 * материал, қалыңдық, қай парақтан кесілгені және КРОМКА ҚАЙ ҚЫРЫНА
 * жабысатыны.
 *
 * Кромканы сөзбен жазу жеткіліксіз — «L1» дегенді цехта әркім әр жаққа
 * түсінеді. Сол себепті биркада детальдің КІШКЕНЕ СЫЗБАСЫ бар: кромка бар
 * қыры қалың сызықпен салынады, әрі қалыңдығы жазылады. Оны айналдырып
 * қойып, детальмен беттестіруге болады.
 */

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { partNumbers } from '../cutList'
import type { NestingResult } from '../nesting'
import type { Catalog, EdgeSpec, Panel } from '../types'
import type { PdfFonts } from './pdf'

export type LabelEdges = {
  /** Кромканың қалыңдығы, мм. `null` — кромка жоқ. */
  L1: number | null
  L2: number | null
  W1: number | null
  W2: number | null
}

export type PartLabel = {
  panelId: string
  /** Деталировкадағы позиция нөмірі. Бирка мен кесте осымен байланысады. */
  position: number
  /** Сол позициядағы нешінші дана. `of` — барлығы қанша. */
  piece: number
  of: number
  name: string
  /** Жобада бірнеше корпус болса — қайсысы. Панель id-нің префиксінен. */
  cabinetId: string | null
  /** Станок кесетін өлшем, мм. */
  cutLength: number
  cutWidth: number
  /** Жиналған детальдің өлшемі, мм — кромкасымен бірге. */
  finishedLength: number
  finishedWidth: number
  thickness: number
  materialName: string
  edges: LabelEdges
  /** Текстура бағыты. Материал текстурасыз болса — `null`. */
  grain: 'along' | 'across' | null
  /** Қай парақтан кесіледі. Раскрой берілмесе — `null`. */
  sheet: number | null
  note: string
}

/**
 * Биркалардың деректері. Раскрой берілсе, әр биркада парақтың нөмірі тұрады —
 * станоктан шыққан детальді бірден өз үйіндісіне қоюға болады.
 */
export function partLabels(
  panels: Panel[],
  catalog: Catalog,
  nesting?: NestingResult,
): PartLabel[] {
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
  const positions = partNumbers(panels, catalog)

  const sheetOf = new Map<string, number>()
  if (nesting) {
    for (const material of nesting.byMaterial) {
      for (const sheet of material.sheets) {
        for (const part of sheet.parts) sheetOf.set(part.panelId, sheet.index)
      }
    }
  }

  const bandThickness = (e: EdgeSpec): number | null => {
    if (!e) return null
    const band = bands.get(e.bandId)
    if (!band) throw new Error(`Кромка табылмады: ${e.bandId}`)
    return band.thickness
  }

  // Позициядағы данасының нөмірі: «2 из 4» деп жазу үшін.
  const total = new Map<number, number>()
  for (const p of panels) {
    const position = positions.get(p.id) ?? 0
    total.set(position, (total.get(position) ?? 0) + 1)
  }
  const seen = new Map<number, number>()

  return panels.map((p) => {
    const material = materials.get(p.materialId)
    if (!material) throw new Error(`Материал табылмады: ${p.materialId}`)
    const position = positions.get(p.id) ?? 0
    const piece = (seen.get(position) ?? 0) + 1
    seen.set(position, piece)

    // Бірнеше корпустан құралған жобада id «шкаф--side-left» болып келеді.
    const separator = p.id.indexOf('--')

    return {
      panelId: p.id,
      position,
      piece,
      of: total.get(position) ?? 1,
      name: p.label,
      cabinetId: separator > 0 ? p.id.slice(0, separator) : null,
      cutLength: p.cutLength,
      cutWidth: p.cutWidth,
      finishedLength: p.finishedLength,
      finishedWidth: p.finishedWidth,
      thickness: material.thickness,
      materialName: material.name,
      edges: {
        L1: bandThickness(p.edges.L1),
        L2: bandThickness(p.edges.L2),
        W1: bandThickness(p.edges.W1),
        W2: bandThickness(p.edges.W2),
      },
      grain: material.hasGrain ? (p.grainAlongLength ? 'along' : 'across') : null,
      sheet: sheetOf.get(p.id) ?? null,
      note: p.note,
    }
  })
}

// ── PDF ──────────────────────────────────────────────────────────────────────

/** A4 кітап бағыты, пункт. */
const PAGE = { w: 595, h: 842 }
const MARGIN = 10
/**
 * Бір бетте 3 × 8 = 24 бирка. Бұл — нарықтағы ең жиі кездесетін 70 × 37 мм
 * этикетка парағының торы; жай қағазға басып, қиып алуға да келеді.
 */
const COLS = 3
const ROWS = 8

const INK = rgb(0.1, 0.1, 0.12)
const MUTED = rgb(0.45, 0.45, 0.5)
const RULE = rgb(0.75, 0.75, 0.78)
const BAND = rgb(0.85, 0.35, 0.1)

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont }

/** Ұяшыққа сыймайтын мәтінді қысқарту: биркада жол ЕШҚАШАН қабаттаспауы керек. */
function clip(font: PDFFont, value: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  let text = value
  while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > maxWidth) {
    text = text.slice(0, -1)
  }
  return `${text}…`
}

function draw(
  ctx: Ctx, x: number, y: number, value: string, size: number,
  { bold = false, color = INK, maxWidth }: { bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number } = {},
): void {
  const font = bold ? ctx.bold : ctx.regular
  ctx.page.drawText(maxWidth === undefined ? value : clip(font, value, size, maxWidth), {
    x, y, size, font, color,
  })
}

/**
 * Детальдің сұлбасы: кромка бар қыры ҚАЛЫҢ әрі қызғылт сары.
 *
 * Пропорция ӘДЕЙІ шындықпен сақталмайды (2000 × 400 деталь биркада жіңішке
 * сызық болып қалар еді) — бұл сызба емес, қырлардың СХЕМАСЫ. Ұзын жағы
 * қайсы екені көрініп тұрсын деп, ені мен биіктігі шектеулі аралықта қысылады.
 */
function edgeDiagram(ctx: Ctx, x: number, y: number, label: PartLabel): void {
  const ratio = Math.min(2.2, Math.max(1.15, label.cutLength / Math.max(1, label.cutWidth)))
  const h = 26
  const w = Math.min(58, h * ratio)

  const side = (
    from: { x: number; y: number }, to: { x: number; y: number }, band: number | null,
  ) => {
    ctx.page.drawLine({
      start: from, end: to,
      thickness: band === null ? 0.6 : 2.4,
      color: band === null ? RULE : BAND,
    })
  }

  // L1/L2 — ұзын қырлар (астыңғы мен үстіңгі), W1/W2 — қысқа (сол мен оң).
  side({ x, y }, { x: x + w, y }, label.edges.L1)
  side({ x, y: y + h }, { x: x + w, y: y + h }, label.edges.L2)
  side({ x, y }, { x, y: y + h }, label.edges.W1)
  side({ x: x + w, y }, { x: x + w, y: y + h }, label.edges.W2)

  const mark = (value: number | null, cx: number, cy: number) => {
    if (value === null) return
    const text = value.toFixed(1)
    const width = ctx.regular.widthOfTextAtSize(text, 5)
    ctx.page.drawText(text, { x: cx - width / 2, y: cy, size: 5, font: ctx.regular, color: BAND })
  }
  mark(label.edges.L1, x + w / 2, y - 6)
  mark(label.edges.L2, x + w / 2, y + h + 2)
  mark(label.edges.W1, x - 7, y + h / 2 - 2)
  mark(label.edges.W2, x + w + 7, y + h / 2 - 2)
}

function drawLabel(ctx: Ctx, x: number, y: number, w: number, h: number, label: PartLabel, projectName: string): void {
  // Қиятын сызық: жай қағазға басқанда цех осы бойымен қияды.
  ctx.page.drawRectangle({ x, y, width: w, height: h, borderColor: RULE, borderWidth: 0.5 })

  const padding = 6
  const left = x + padding
  const right = x + w - padding
  let top = y + h - padding - 8

  // Позиция нөмірі — ең үлкен сан: цех детальді осымен атайды.
  // ⚠ «№» (U+2116) қаріп жиынтығында ЖОҚ — ол PDF-те үнсіз түсіп қалады
  // (₸ сияқты). Сондықтан «Поз.» деп жазылады; тесті бар.
  draw(ctx, left, top, `Поз. ${label.position}`, 11, { bold: true })
  const pieces = label.of > 1 ? `${label.piece}/${label.of}` : ''
  const sheet = label.sheet === null ? '' : `лист ${label.sheet}`
  const corner = [pieces, sheet].filter(Boolean).join(' · ')
  if (corner) {
    const width = ctx.regular.widthOfTextAtSize(corner, 6.5)
    draw(ctx, right - width, top + 2, corner, 6.5, { color: MUTED })
  }

  top -= 12
  draw(ctx, left, top, label.name, 8.5, { bold: true, maxWidth: w - padding * 2 })

  top -= 14
  draw(ctx, left, top, `${label.cutLength} × ${label.cutWidth}`, 13, { bold: true })
  draw(ctx, left, top - 8, 'рез, мм', 5.5, { color: MUTED })

  const finished = `готовый ${label.finishedLength} × ${label.finishedWidth}`
  draw(ctx, left, top - 17, finished, 6, { color: MUTED, maxWidth: w - padding * 2 - 66 })

  // Сұлба материал жолынан ЖОҒАРЫ тұруы керек: астындағы кромка белгісі
  // (L1) мәтінмен беттесіп, «16 мм 2.0» болып оқылмай қалатын.
  edgeDiagram(ctx, right - 66, y + padding + 24, label)

  const grain = label.grain === null ? '' : label.grain === 'along' ? ' · текстура вдоль' : ' · текстура поперёк'
  draw(ctx, left, y + padding + 8, `${label.materialName}, ${label.thickness} мм`, 6, {
    color: MUTED, maxWidth: w - padding * 2 - 4,
  })
  const bottom = [label.cabinetId, projectName].filter(Boolean).join(' · ') + grain
  draw(ctx, left, y + padding, bottom, 5.5, { color: MUTED, maxWidth: w - padding * 2 })
}

export type LabelsPdfInput = {
  labels: PartLabel[]
  projectName: string
  fonts: PdfFonts
}

/** Биркалар парағы: A4-ке 24 дана, детальдер ретімен. */
export async function labelsPdf(input: LabelsPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(input.fonts.regular, { subset: true })
  const bold = await doc.embedFont(input.fonts.bold, { subset: true })

  const cellW = (PAGE.w - MARGIN * 2) / COLS
  const cellH = (PAGE.h - MARGIN * 2) / ROWS
  const perPage = COLS * ROWS

  // Деталь жоқ болса да бос бет шығады: PDF-те бір бет болуы керек.
  const pages = Math.max(1, Math.ceil(input.labels.length / perPage))
  for (let p = 0; p < pages; p += 1) {
    const page = doc.addPage([PAGE.w, PAGE.h])
    const ctx: Ctx = { page, regular, bold }
    const slice = input.labels.slice(p * perPage, (p + 1) * perPage)
    slice.forEach((label, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = MARGIN + col * cellW
      // Жоғарыдан төмен толтырамыз: адам биркаларды солай оқиды.
      const y = PAGE.h - MARGIN - (row + 1) * cellH
      drawLabel(ctx, x, y, cellW, cellH, label, input.projectName)
    })
  }

  return doc.save()
}

/**
 * Биркалардың CSV-і: цехта этикетка принтері (Zebra, TSC) болса, оның
 * бағдарламасы дәл осындай кестені оқиды.
 */
export function labelsToCsv(labels: PartLabel[]): string {
  const header = [
    'Позиция', 'Дана', 'Наименование', 'Рез длина', 'Рез ширина',
    'Готовый длина', 'Готовый ширина', 'Толщина', 'Материал',
    'L1', 'L2', 'W1', 'W2', 'Текстура', 'Лист', 'Корпус', 'Примечание',
  ]
  const band = (v: number | null) => (v === null ? '' : v.toFixed(1))
  const rows = labels.map((l) => [
    String(l.position),
    l.of > 1 ? `${l.piece}/${l.of}` : '1',
    l.name,
    String(l.cutLength), String(l.cutWidth),
    String(l.finishedLength), String(l.finishedWidth),
    String(l.thickness), l.materialName,
    band(l.edges.L1), band(l.edges.L2), band(l.edges.W1), band(l.edges.W2),
    l.grain === null ? 'нет' : l.grain === 'along' ? 'вдоль длины' : 'поперёк длины',
    l.sheet === null ? '' : String(l.sheet),
    l.cabinetId ?? '',
    l.note,
  ])

  // Нүктелі үтір — Excel орыс локалінде осыны бөлгіш деп таниды.
  const escape = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [header, ...rows].map((r) => r.map(escape).join(';')).join('\n')
}
