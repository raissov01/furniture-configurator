/**
 * PDF сызбасы (PHASE-2 A5): фас, бүйір, жоспар — өлшемдерімен, плюс
 * ажыратылған изометрия, деталіне позиция нөмірі қойылған.
 *
 * Қаріп сыртта беріледі (Uint8Array): ядро файл жүйесіне тимейді, ал pdf-lib-тің
 * стандарт қаріптері кириллицаны білмейді.
 */

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { CUT_LIST_COLUMNS, formatCutList, partNumbers } from '../cutList'
import { fitTransform, projectElevation, projectIsometric } from './drawing'
import type { Bounds, ElevationView } from './drawing'
import type { CabinetConfig, Catalog, Panel } from '../types'

export type PdfFonts = { regular: Uint8Array; bold: Uint8Array }

export type AssemblyPdfInput = {
  cabinet: CabinetConfig
  panels: Panel[]
  catalog: Catalog
  projectName: string
  fonts: PdfFonts
}

/** A4 альбом, пункт. */
const PAGE = { w: 842, h: 595 }
const MARGIN = 28
const INK = rgb(0.12, 0.12, 0.14)
const THIN = rgb(0.55, 0.55, 0.58)
const DIM = rgb(0.35, 0.45, 0.7)

const VIEW_TITLE: Record<ElevationView, string> = {
  front: 'Вид спереди',
  side: 'Вид сбоку',
  plan: 'Вид сверху (план)',
}

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont }

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color = INK, thickness = 0.7): void {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness })
}

function label(ctx: Ctx, x: number, y: number, value: string, size = 8, bold = false, color = INK): void {
  ctx.page.drawText(value, { x, y, size, font: bold ? ctx.bold : ctx.regular, color })
}

function centred(ctx: Ctx, cx: number, y: number, value: string, size = 8, color = INK): void {
  const w = ctx.regular.widthOfTextAtSize(value, size)
  ctx.page.drawText(value, { x: cx - w / 2, y, size, font: ctx.regular, color })
}

/** Өлшем сызығы: екі жағында штрих, ортасында сан. */
function dimension(
  ctx: Ctx, x1: number, y1: number, x2: number, y2: number, text: string, vertical: boolean,
): void {
  line(ctx.page, x1, y1, x2, y2, DIM, 0.5)
  const tick = 3
  if (vertical) {
    line(ctx.page, x1 - tick, y1, x1 + tick, y1, DIM, 0.5)
    line(ctx.page, x2 - tick, y2, x2 + tick, y2, DIM, 0.5)
    const w = ctx.regular.widthOfTextAtSize(text, 7)
    ctx.page.drawRectangle({
      x: x1 - w / 2 - 2, y: (y1 + y2) / 2 - 4, width: w + 4, height: 8,
      color: rgb(1, 1, 1),
    })
    centred(ctx, x1, (y1 + y2) / 2 - 2.5, text, 7, DIM)
  } else {
    line(ctx.page, x1, y1 - tick, x1, y1 + tick, DIM, 0.5)
    line(ctx.page, x2, y2 - tick, x2, y2 + tick, DIM, 0.5)
    const w = ctx.regular.widthOfTextAtSize(text, 7)
    ctx.page.drawRectangle({
      x: (x1 + x2) / 2 - w / 2 - 2, y: y1 - 3.5, width: w + 4, height: 8, color: rgb(1, 1, 1),
    })
    centred(ctx, (x1 + x2) / 2, y1 - 2, text, 7, DIM)
  }
}

/** Мәтінді бағанға сыйдыру: сыймаса қысқартып, соңына … қояды. */
function fitText(font: PDFFont, value: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  let text = value
  while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > maxWidth) {
    text = text.slice(0, -1)
  }
  return `${text}…`
}

function titleBlock(ctx: Ctx, input: AssemblyPdfInput, page: string): void {
  const { cabinet, projectName } = input
  const y = PAGE.h - MARGIN
  label(ctx, MARGIN, y - 9, projectName, 12, true)
  label(ctx, MARGIN, y - 22, cabinet.name, 9, false, THIN)
  const dims = `${cabinet.height} (H) × ${cabinet.width} (W) × ${cabinet.depth} (D) мм`
  const w = ctx.bold.widthOfTextAtSize(dims, 10)
  label(ctx, PAGE.w - MARGIN - w, y - 9, dims, 10, true)
  const meta = `${page}   ·   ${cabinet.construction === 'sidesOverlay' ? 'боковины накрывают крышку и дно' : 'крышка и дно накрывают боковины'}   ·   задняя стенка: ${cabinet.back.mode === 'overlay' ? 'внакладку' : 'в паз'}`
  const mw = ctx.regular.widthOfTextAtSize(meta, 8)
  label(ctx, PAGE.w - MARGIN - mw, y - 22, meta, 8, false, THIN)
  line(ctx.page, MARGIN, y - 30, PAGE.w - MARGIN, y - 30, THIN, 0.5)
}

function drawElevation(
  ctx: Ctx,
  input: AssemblyPdfInput,
  view: ElevationView,
  box: { x: number; y: number; w: number; h: number },
  thicknessOf: (p: Panel) => number,
): void {
  const { rects, bounds } = projectElevation(input.panels, thicknessOf, view)
  const { scale, tx, ty } = fitTransform(bounds, box, 34)
  const X = (v: number) => v * scale + tx
  const Y = (v: number) => v * scale + ty

  label(ctx, box.x, box.y + box.h - 8, VIEW_TITLE[view], 9, true)
  label(ctx, box.x + ctx.bold.widthOfTextAtSize(VIEW_TITLE[view], 9) + 8, box.y + box.h - 8,
    `М 1:${Math.round(1 / scale * (72 / 25.4))}`, 7, false, THIN)

  for (const rect of rects) {
    // Накладной фасад корпустан бөлек оқылуы үшін ашық түспен
    const isFront = rect.role === 'front'
    ctx.page.drawRectangle({
      x: X(rect.x), y: Y(rect.y), width: rect.w * scale, height: rect.h * scale,
      borderColor: INK, borderWidth: isFront ? 0.4 : 0.7,
      color: isFront ? rgb(0.97, 0.97, 0.98) : rgb(0.93, 0.93, 0.95),
      opacity: isFront ? 0.5 : 1,
    })
  }

  const { cabinet } = input
  const left = X(bounds.minX)
  const right = X(bounds.maxX)
  const bottom = Y(bounds.minY)
  const top = Y(bounds.maxY)

  if (view === 'front') {
    dimension(ctx, left, bottom - 16, right, bottom - 16, `${cabinet.width}`, false)
    dimension(ctx, left - 16, bottom, left - 16, top, `${cabinet.height}`, true)
    // Секция ендері екінші өлшем қатарында
    const dividers = input.panels.filter((p) => p.role === 'divider')
      .map((p) => p.position.x).sort((a, b) => a - b)
    if (dividers.length > 0) {
      const t = thicknessOf(input.panels.find((p) => p.role === 'side')!)
      const edges = [t, ...dividers.flatMap((d) => [d, d + t]), cabinet.width - t]
      for (let i = 0; i < edges.length; i += 2) {
        const a = edges[i]!
        const b = edges[i + 1]!
        dimension(ctx, X(a), bottom - 30, X(b), bottom - 30, `${b - a}`, false)
      }
    }
  } else if (view === 'side') {
    dimension(ctx, left, bottom - 16, right, bottom - 16, `${cabinet.depth}`, false)
    dimension(ctx, left - 16, bottom, left - 16, top, `${cabinet.height}`, true)
    // Сөре биіктіктері — монтажшы соны сұрайды
    const shelves = input.panels.filter((p) => p.role === 'shelf')
      .map((p) => p.position.y).sort((a, b) => a - b)
    for (const y of shelves) {
      line(ctx.page, right + 3, Y(y), right + 12, Y(y), DIM, 0.4)
      label(ctx, right + 14, Y(y) - 2.5, `${y}`, 6.5, false, DIM)
    }
  } else {
    dimension(ctx, left, bottom - 16, right, bottom - 16, `${cabinet.width}`, false)
    dimension(ctx, right + 16, bottom, right + 16, top, `${cabinet.depth}`, true)
  }
}

function drawIsometric(
  ctx: Ctx,
  input: AssemblyPdfInput,
  box: { x: number; y: number; w: number; h: number },
  thicknessOf: (p: Panel) => number,
  explode: number,
): void {
  const { cabinet } = input
  const { polygons, bounds } = projectIsometric(
    input.panels, thicknessOf,
    { width: cabinet.width, height: cabinet.height, depth: cabinet.depth },
    explode,
  )
  const { scale, tx, ty } = fitTransform(bounds, box, 40)
  const numbers = partNumbers(input.panels, input.catalog)

  for (const poly of polygons) {
    const pts = poly.points.map(([x, y]) => ({ x: x * scale + tx, y: y * scale + ty }))
    // drawSvgPath SVG координатасын күтеді: (x, y) нүктесінен бастап Y ТӨМЕН
    // қарай өседі. Сондықтан бастауды беттің төбесіне қойып, нүктелерді
    // аударамыз — әйтпесе бүкіл сурет беттен тыс, теріс жаққа кетеді.
    ctx.page.drawSvgPath(
      `M ${pts.map((p) => `${p.x.toFixed(2)} ${(PAGE.h - p.y).toFixed(2)}`).join(' L ')} Z`,
      {
        x: 0, y: PAGE.h,
        color: rgb(poly.shade, poly.shade, poly.shade * 1.02),
        borderColor: INK, borderWidth: 0.4,
      },
    )
  }

  // Позиция нөмірлері: әр детальдің тек бір данасына
  const seen = new Set<number>()
  for (const poly of polygons) {
    const n = numbers.get(poly.panelId)
    if (n === undefined || seen.has(n)) continue
    seen.add(n)
    const cx = poly.points.reduce((s, p) => s + p[0], 0) / poly.points.length * scale + tx
    const cy = poly.points.reduce((s, p) => s + p[1], 0) / poly.points.length * scale + ty
    ctx.page.drawCircle({ x: cx, y: cy, size: 6.5, color: rgb(1, 1, 1), borderColor: INK, borderWidth: 0.5 })
    centred(ctx, cx, cy - 2.5, String(n), 7)
  }

  label(ctx, box.x, box.y + box.h - 8, 'Сборка в разнесённом виде', 9, true)
  label(ctx, box.x, box.y + box.h - 19, 'Номера соответствуют позициям деталировки', 7, false, THIN)
}

function drawCutList(ctx: Ctx, input: AssemblyPdfInput): void {
  const rows = formatCutList(input.panels, input.catalog)
  const cols = CUT_LIST_COLUMNS
  const WIDTH: Partial<Record<(typeof cols)[number]['key'], number>> = {
    name: 78, qty: 34,
    finishedLength: 44, finishedWidth: 46, cutLength: 44, cutWidth: 46,
    thickness: 40, material: 150,
    edgeL1: 26, edgeL2: 26, edgeW1: 26, edgeW2: 26,
    grain: 62, note: 118,
  }
  const widths = cols.map((c) => WIDTH[c.key] ?? 44)
  const numberColumn = 20

  const x = MARGIN
  let y = PAGE.h - MARGIN - 55

  const colX: number[] = [x + numberColumn]
  widths.forEach((w, i) => colX.push(colX[i]! + w))

  label(ctx, x, y + 10, '№', 7, true)
  cols.forEach((c, i) => {
    label(ctx, colX[i]!, y + 10, c.header, 7, true,
      c.audience === 'client' ? rgb(0.13, 0.35, 0.6) : c.group === 'РЕЗ · цех' ? rgb(0.6, 0.33, 0.05) : INK)
    // Топ атауы тобының БІРІНШІ бағанында ғана — әйтпесе «КРОМКА» төрт рет
    // қайталанып, бір-бірінің үстіне түседі.
    if (c.group && c.group !== cols[i - 1]?.group) {
      label(ctx, colX[i]!, y + 19, c.group.split(' · ')[0]!, 5.5, true, THIN)
    }
  })
  line(ctx.page, MARGIN, y + 5, PAGE.w - MARGIN, y + 5, INK, 0.6)

  y -= 4
  rows.forEach((row, i) => {
    y -= 12
    if (i % 2 === 1) {
      ctx.page.drawRectangle({
        x: MARGIN - 2, y: y - 3, width: PAGE.w - 2 * MARGIN + 4, height: 12,
        color: rgb(0.965, 0.965, 0.975),
      })
    }
    label(ctx, MARGIN, y, String(i + 1), 7, true)
    cols.forEach((c, ci) => {
      const text = fitText(ctx.regular, String(row[c.key]), 7, (widths[ci] ?? 44) - 6)
      label(ctx, colX[ci]!, y, text, 7, false,
        c.group === 'РЕЗ · цех' ? rgb(0.5, 0.28, 0.04) : c.audience === 'client' ? rgb(0.2, 0.35, 0.55) : INK)
    })
  })

  const pieces = rows.reduce((s, r) => s + r.qty, 0)
  y -= 16
  line(ctx.page, MARGIN, y + 9, PAGE.w - MARGIN, y + 9, INK, 0.6)
  label(ctx, MARGIN, y, `Позиций: ${rows.length}    Деталей: ${pieces}`, 8, true)

  const holes = input.panels.reduce((s, p) => s + p.drilling.length, 0)
  if (holes > 0) label(ctx, MARGIN + 200, y, `Присадка: ${holes} отв.`, 8, true, THIN)
}

export async function assemblyDrawingPdf(input: AssemblyPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(input.fonts.regular, { subset: true })
  const bold = await doc.embedFont(input.fonts.bold, { subset: true })

  const thicknessMap = new Map(input.catalog.materials.map((m) => [m.id, m.thickness]))
  const thicknessOf = (p: Panel) => thicknessMap.get(p.materialId) ?? 16

  // 1-бет: үш проекция
  {
    const page = doc.addPage([PAGE.w, PAGE.h])
    const ctx: Ctx = { page, regular, bold }
    titleBlock(ctx, input, 'Лист 1 из 3 — проекции')
    const top = PAGE.h - MARGIN - 40
    const colW = (PAGE.w - 2 * MARGIN) / 3
    const h = top - MARGIN
    const views: ElevationView[] = ['front', 'side', 'plan']
    views.forEach((view, i) => {
      drawElevation(ctx, input, view, { x: MARGIN + i * colW, y: MARGIN, w: colW, h }, thicknessOf)
    })
  }

  // 2-бет: ажыратылған изометрия
  {
    const page = doc.addPage([PAGE.w, PAGE.h])
    const ctx: Ctx = { page, regular, bold }
    titleBlock(ctx, input, 'Лист 2 из 3 — сборка')
    const top = PAGE.h - MARGIN - 40
    drawIsometric(
      ctx, input,
      { x: MARGIN, y: MARGIN, w: PAGE.w - 2 * MARGIN, h: top - MARGIN },
      thicknessOf,
      Math.max(input.cabinet.width, input.cabinet.depth) * 0.22,
    )
  }

  // 3-бет: деталировка
  {
    const page = doc.addPage([PAGE.w, PAGE.h])
    const ctx: Ctx = { page, regular, bold }
    titleBlock(ctx, input, 'Лист 3 из 3 — деталировка')
    drawCutList(ctx, input)
  }

  return doc.save()
}

export type { Bounds }
