/**
 * Раскрой картасының PDF-і: цехқа басып беретін парақ.
 *
 * Бірінші бет — қорытынды (қай материалдан неше парақ, қалдық қанша),
 * әрі қарай әр параққа бір бет. Оператор осыны станоктың жанына іліп қояды.
 *
 * Қаріп сыртта беріледі: ядро файл жүйесіне тимейді, ал pdf-lib-тің стандарт
 * қаріптері кириллицаны білмейді.
 */

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import type { NestedSheet, NestingResult } from '../nesting'
import type { PdfFonts } from './pdf'

/** A4 альбом, пункт. */
const PAGE = { w: 842, h: 595 }
const MARGIN = 32
const INK = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.45, 0.45, 0.5)
const PART = rgb(0.89, 0.78, 0.42)
const PART_EDGE = rgb(0.49, 0.37, 0.08)
const OFFCUT = rgb(0.13, 0.77, 0.37)

export type NestingPdfInput = {
  nesting: NestingResult
  projectName: string
  fonts: PdfFonts
}

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont }

function label(ctx: Ctx, x: number, y: number, value: string, size = 9, bold = false, color = INK): void {
  ctx.page.drawText(value, { x, y, size, font: bold ? ctx.bold : ctx.regular, color })
}

function centred(ctx: Ctx, cx: number, cy: number, value: string, size: number, color = INK): void {
  const w = ctx.regular.widthOfTextAtSize(value, size)
  ctx.page.drawText(value, { x: cx - w / 2, y: cy - size / 3, size, font: ctx.regular, color })
}

export async function nestingPdf(input: NestingPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(input.fonts.regular, { subset: true })
  const bold = await doc.embedFont(input.fonts.bold, { subset: true })

  // ── Қорытынды беті ─────────────────────────────────────────────────────────
  {
    const page = doc.addPage([PAGE.w, PAGE.h])
    const ctx: Ctx = { page, regular, bold }
    let y = PAGE.h - MARGIN

    label(ctx, MARGIN, y, 'Карта раскроя', 16, true)
    y -= 18
    label(ctx, MARGIN, y, input.projectName, 10, false, MUTED)
    y -= 26

    label(ctx, MARGIN, y, 'Материал', 9, true)
    label(ctx, MARGIN + 320, y, 'Листов', 9, true)
    label(ctx, MARGIN + 400, y, 'Отход', 9, true)
    y -= 6
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y },
      color: MUTED, thickness: 0.5,
    })
    y -= 14

    for (const group of input.nesting.byMaterial) {
      label(ctx, MARGIN, y, group.materialName, 9)
      label(ctx, MARGIN + 320, y, String(group.sheets.length), 9)
      label(ctx, MARGIN + 400, y, `${group.wastePercent.toFixed(1)} %`, 9)
      y -= 14
    }

    y -= 8
    label(ctx, MARGIN, y, `Всего листов: ${input.nesting.sheetCount}`, 10, true)

    if (input.nesting.unplaced.length > 0) {
      y -= 22
      label(ctx, MARGIN, y, 'Не помещаются на лист:', 9, true, rgb(0.7, 0.1, 0.1))
      for (const item of input.nesting.unplaced) {
        y -= 12
        label(ctx, MARGIN + 10, y, `${item.label} — ${item.reason}`, 8, false, rgb(0.7, 0.1, 0.1))
      }
    }
  }

  // ── Әр параққа бір бет ─────────────────────────────────────────────────────
  for (const group of input.nesting.byMaterial) {
    for (const sheet of group.sheets) {
      drawSheetPage(doc.addPage([PAGE.w, PAGE.h]), { regular, bold }, sheet, group.materialName)
    }
  }

  return doc.save()
}

function drawSheetPage(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  sheet: NestedSheet,
  materialName: string,
): void {
  const ctx: Ctx = { page, ...fonts }
  const headerHeight = 46

  label(ctx, MARGIN, PAGE.h - MARGIN, `${materialName} — лист ${sheet.index}`, 12, true)
  label(
    ctx, MARGIN, PAGE.h - MARGIN - 15,
    `Лист ${sheet.sheetWidth}×${sheet.sheetHeight} мм · деталей: ${sheet.parts.length}` +
      (sheet.offcuts.length > 0 ? ` · деловой отход: ${sheet.offcuts.length}` : ''),
    9, false, MUTED,
  )

  // Парақ бетке сыятындай масштаб. Пропорция САҚТАЛАДЫ: бұрмаланған карта
  // бойынша цех қате шешім қабылдайды.
  const availW = PAGE.w - MARGIN * 2
  const availH = PAGE.h - MARGIN * 2 - headerHeight
  const scale = Math.min(availW / sheet.sheetWidth, availH / sheet.sheetHeight)
  const originX = MARGIN
  const originY = MARGIN

  /** Парақ координатасы (мм, y жоғары) → бет координатасы (пункт). */
  const px = (x: number) => originX + x * scale
  const py = (y: number) => originY + y * scale

  page.drawRectangle({
    x: px(0), y: py(0),
    width: sheet.sheetWidth * scale, height: sheet.sheetHeight * scale,
    borderColor: INK, borderWidth: 1,
  })

  page.drawRectangle({
    x: px(sheet.usable.x), y: py(sheet.usable.y),
    width: sheet.usable.width * scale, height: sheet.usable.height * scale,
    borderColor: MUTED, borderWidth: 0.7, borderDashArray: [4, 3],
  })

  for (const off of sheet.offcuts) {
    page.drawRectangle({
      x: px(off.x), y: py(off.y),
      width: off.width * scale, height: off.height * scale,
      color: OFFCUT, opacity: 0.12,
      borderColor: OFFCUT, borderWidth: 0.6,
    })
  }

  for (const part of sheet.parts) {
    page.drawRectangle({
      x: px(part.x), y: py(part.y),
      width: part.width * scale, height: part.height * scale,
      color: PART, borderColor: PART_EDGE, borderWidth: 0.8,
    })
    const cx = px(part.x + part.width / 2)
    const cy = py(part.y + part.height / 2)
    const box = Math.min(part.width, part.height) * scale
    // Деталь тым кішкентай болса жазу оқылмайды әрі көршісіне кіріп кетеді.
    if (box < 16) continue
    const size = Math.max(5, Math.min(9, box / 5))
    centred(ctx, cx, cy + size * 0.7, part.label, size)
    centred(ctx, cx, cy - size * 0.7, `${part.width}×${part.height}`, size, MUTED)
  }
}
