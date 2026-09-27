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
import { cutPlan } from '../cutPlan'
import type { CutLine } from '../cutPlan'
import type { PdfFonts } from './pdf'
import { stampPdfBrand } from '../brand'
import { mapLegendCapacity, partCaption, sheetPageCount } from './nestingPresentation'

/** A4 альбом, пункт. */
const PAGE = { w: 842, h: 595 }
const MARGIN = 32
const INK = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.45, 0.45, 0.5)
const PART = rgb(0.88, 0.91, 0.94)
const PART_EDGE = rgb(0.20, 0.28, 0.35)
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

  // ── Әр параққа бір бет ─────────────────────────────────────────────────────
  const plan = cutPlan(input.nesting)
  let pageCount = 0
  for (const [groupIndex, group] of input.nesting.byMaterial.entries()) {
    for (const [sheetIndex, sheet] of group.sheets.entries()) {
      pageCount += 1
      const legendShown = drawSheetPage(doc.addPage([PAGE.w, PAGE.h]), { regular, bold }, sheet,
        group.materialName, plan.byMaterial[groupIndex]!.sheets[sheetIndex]!.cuts,
        input.projectName, input.nesting.sheetCount, group.wastePercent)
      for (let start = legendShown; start < sheet.parts.length; start += 40) {
        const page = doc.addPage([PAGE.w, PAGE.h])
        const continuation: Ctx = { page, regular, bold }
        label(continuation, MARGIN, PAGE.h - MARGIN,
          `${group.materialName} · лист ${sheet.index} · обозначения (продолжение)`, 12, true)
        for (const [offset, part] of sheet.parts.slice(start, start + 40).entries()) {
          label(continuation, MARGIN, PAGE.h - MARGIN - 25 - offset * 12,
            `${start + offset + 1}. ${part.label} · ${part.width} × ${part.height} мм`, 8)
        }
      }
    }
  }
  if (pageCount < sheetPageCount(input.nesting.sheetCount)) {
    const page = doc.addPage([PAGE.w, PAGE.h])
    label({ page, regular, bold }, MARGIN, PAGE.h - MARGIN, `Карта раскроя · ${input.projectName}`, 16, true)
    label({ page, regular, bold }, MARGIN, PAGE.h - MARGIN - 22, 'Листов: 0', 10)
  }

  stampPdfBrand(doc)
  return doc.save()
}

function drawSheetPage(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  sheet: NestedSheet,
  materialName: string,
  cuts: readonly CutLine[],
  projectName: string,
  totalSheets: number,
  wastePercent: number,
): number {
  const ctx: Ctx = { page, ...fonts }
  const headerHeight = 54
  const legendCapacity = mapLegendCapacity(PAGE.h, MARGIN, headerHeight)

  label(ctx, MARGIN, PAGE.h - MARGIN, `Карта раскроя · ${projectName}`, 14, true)
  label(ctx, MARGIN, PAGE.h - MARGIN - 17, `${materialName} · лист ${sheet.index} / ${totalSheets}`, 10, true)
  label(
    ctx, MARGIN, PAGE.h - MARGIN - 32,
    `Лист ${sheet.sheetHeight} (H) × ${sheet.sheetWidth} (W) мм · деталей: ${sheet.parts.length} · отход: ${wastePercent.toFixed(1)} %` +
      (sheet.offcuts.length > 0 ? ` · деловой отход: ${sheet.offcuts.length}` : ''),
    8, false, MUTED,
  )
  label(ctx, MARGIN, PAGE.h - MARGIN - 44, 'Красные линии и номера — порядок резов', 8, false, MUTED)

  // Парақ бетке сыятындай масштаб. Пропорция САҚТАЛАДЫ: бұрмаланған карта
  // бойынша цех қате шешім қабылдайды.
  const legendW = 155
  const availW = PAGE.w - MARGIN * 2 - legendW
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

  for (const [index, part] of sheet.parts.entries()) {
    page.drawRectangle({
      x: px(part.x), y: py(part.y),
      width: part.width * scale, height: part.height * scale,
      color: PART, borderColor: PART_EDGE, borderWidth: 0.8,
    })
    const cx = px(part.x + part.width / 2)
    const cy = py(part.y + part.height / 2)
    const caption = partCaption(part.label, part.width, part.height,
      part.width * scale, part.height * scale, index + 1,
      (value, size) => fonts.regular.widthOfTextAtSize(value, size))
    if (caption.lines.length === 2) {
      centred(ctx, cx, cy + 5, caption.lines[0]!, caption.size)
      centred(ctx, cx, cy - 5, caption.lines[1]!, caption.size, MUTED)
    } else {
      centred(ctx, cx, cy, caption.lines[0]!, caption.size)
    }
    const legendY = PAGE.h - MARGIN - headerHeight - 9 - index * 13
    if (index < legendCapacity) label(ctx, MARGIN + availW + 10, legendY,
      `${index + 1}. ${part.label} ${part.width} × ${part.height}`, 7.5)
  }

  for (const cut of cuts) {
    const x1 = cut.axis === 'v' ? cut.at : cut.from
    const y1 = cut.axis === 'v' ? cut.from : cut.at
    const x2 = cut.axis === 'v' ? cut.at : cut.to
    const y2 = cut.axis === 'v' ? cut.to : cut.at
    page.drawLine({ start: { x: px(x1), y: py(y1) }, end: { x: px(x2), y: py(y2) },
      color: rgb(0.7, 0.12, 0.08), thickness: 0.6, opacity: 0.75 })
    centred(ctx, px((x1 + x2) / 2), py((y1 + y2) / 2), String(cut.order), 8, rgb(0.55, 0.08, 0.06))
  }
  return legendCapacity
}
