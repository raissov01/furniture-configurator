/**
 * Коммерциялық ұсыныс (КП) — клиент оқитын құжат.
 *
 * ЕРЕЖЕ: бағасы толтырылмаған позиция болса, құжат МҮЛДЕ шықпайды
 * (`ConfigValidationError`). Ойдан жазылған баға клиентке кеткен ұсынысқа
 * түседі, ал ол цехтың ақшасы (§6). Тексеру экранда ғана емес, экспорттың
 * өзінде тұр: UI-ды айналып өтіп шақыруға болмайды.
 *
 * Күн сыртта беріледі: ядро жүйе сағатына тәуелді болмауы керек, әйтпесе
 * бірдей жобадан екі түрлі файл шығады да, тест жазу мүмкін болмайды.
 */

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { ConfigValidationError } from '../errors'
import { formatTengeExact, quoteTotalsView } from '../pricing'
import type { PriceBreakdown } from '../pricing'
import type { ShopProfile } from '../shop'
import { projectInfoRows } from './pdf'
import type { PdfFonts } from './pdf'
import { BRAND, stampPdfBrand } from '../brand'
import { quoteSummaryRows, readableBrandText, shopContactRows } from './quotePresentation'

/** A4 портрет, пункт. */
const PAGE = { w: 595, h: 842 }
const MARGIN = 40
const INK = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.45, 0.45, 0.5)
const RULE = rgb(0.8, 0.8, 0.84)

/** Қаріп жиынтығында U+20B8 міндетті түрде болуы тиіс. */
const CURRENCY = '₸'
const money = (minor: number) => formatTengeExact(minor, CURRENCY)

export type QuotePdfInput = {
  price: PriceBreakdown
  shop: ShopProfile
  projectName: string
  /** Құжаттағы күн, дайын жол күйінде (мысалы «30.08.2026»). */
  date: string
  /** Клиенттің аты — бос болса, жол мүлде басылмайды. */
  customer?: string
  /** Тапсырыс нөмірі — «Заказ». Бос болса, жол мүлде басылмайды. */
  orderNo?: string
  /** Жобаны жасаған дизайнер/менеджер аты. Бос болса, жол мүлде басылмайды. */
  designer?: string
  /** Еркін ескертпе. Бос болса, жол мүлде басылмайды. */
  note?: string
  fonts: PdfFonts
}

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont }

export type QuoteSheetRow = { materialId: string; materialName: string; sheets: number }

/** The client sees the purchased sheets from nesting even when a sale price hides costs. */
export function quoteSheetRows(price: PriceBreakdown): QuoteSheetRow[] {
  return price.byMaterial
    .filter((row) => row.sheets > 0)
    .map((row) => ({ materialId: row.materialId, materialName: row.materialName, sheets: row.sheets }))
    .sort((a, b) => a.materialId.localeCompare(b.materialId))
}

const COL = { sum: PAGE.w - MARGIN }

function label(ctx: Ctx, x: number, y: number, value: string, size = 9, bold = false, color = INK): void {
  ctx.page.drawText(value, { x, y, size, font: bold ? ctx.bold : ctx.regular, color })
}

function right(ctx: Ctx, xRight: number, y: number, value: string, size = 9, bold = false, color = INK): void {
  const font = bold ? ctx.bold : ctx.regular
  ctx.page.drawText(value, { x: xRight - font.widthOfTextAtSize(value, size), y, size, font, color })
}

function rule(ctx: Ctx, y: number, color = RULE): void {
  ctx.page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, color, thickness: 0.6 })
}

export async function quotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  if (input.price.missingPrices.length > 0) {
    throw new ConfigValidationError(
      'shop.prices',
      `не заданы цены: ${[...new Set(input.price.missingPrices)].join('; ')}`,
      'заполните цены в настройках цеха',
    )
  }

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(input.fonts.regular, { subset: true })
  const bold = await doc.embedFont(input.fonts.bold, { subset: true })

  let page = doc.addPage([PAGE.w, PAGE.h])
  let ctx: Ctx = { page, regular, bold }
  let y = PAGE.h - MARGIN

  /** Беттің түбіне жеткенде жаңа бет ашады. */
  const need = (space: number): void => {
    if (y - space > MARGIN) return
    page = doc.addPage([PAGE.w, PAGE.h])
    ctx = { page, regular, bold }
    y = PAGE.h - MARGIN
  }

  const hex = input.shop.brandColor ?? BRAND.color
  const brand = rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)
  const textHex = readableBrandText(hex)
  const brandText = rgb(parseInt(textHex.slice(1, 3), 16) / 255,
    parseInt(textHex.slice(3, 5), 16) / 255, parseInt(textHex.slice(5, 7), 16) / 255)
  page.drawRectangle({ x: MARGIN, y: y + 17, width: PAGE.w - MARGIN * 2, height: 3, color: brand })
  label(ctx, MARGIN, y, 'Коммерческое предложение', 16, true, brandText)
  right(ctx, PAGE.w - MARGIN, y, input.date, 9, false, MUTED)
  y -= 25
  if (input.shop.logoDataUrl) {
    const imageBytes = Uint8Array.from(atob(input.shop.logoDataUrl.split(',')[1]!), (c) => c.charCodeAt(0))
    const image = input.shop.logoDataUrl.startsWith('data:image/png;')
      ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes)
    const scale = Math.min(1, 80 / image.width, 28 / image.height)
    page.drawImage(image, { x: PAGE.w - MARGIN - image.width * scale, y: y - 8,
      width: image.width * scale, height: image.height * scale })
  } else {
    page.drawRectangle({ x: PAGE.w - MARGIN - 75, y: y - 6, width: 16, height: 16, color: brand })
    label(ctx, PAGE.w - MARGIN - 71, y - 2, 'A', 10, true, rgb(1, 1, 1))
    right(ctx, PAGE.w - MARGIN, y, BRAND.name, 8, true, brandText)
  }
  for (const [index, row] of shopContactRows(input.shop).entries()) {
    label(ctx, MARGIN, y, row, index === 0 ? 11 : 9, index === 0, index === 0 ? brandText : MUTED)
    y -= index === 0 ? 16 : 13
  }
  y -= 8
  label(ctx, MARGIN, y, `Проект: ${input.projectName}`, 10)
  y -= 14
  // Тапсырыс реквизиттері (Заказ/Заказчик/Дизайнер/Примечание) — толтырылмаған
  // өріс мүлде басылмайды, projectInfoRows соны кепілдейді.
  for (const row of projectInfoRows({
    orderNo: input.orderNo, client: input.customer, designer: input.designer, note: input.note,
  })) {
    label(ctx, MARGIN, y, `${row.label}: ${row.value}`, 10)
    y -= 14
  }

  need(60)
  y -= 4
  rule(ctx, y)
  y -= 16
  const totals = quoteTotalsView(input.price)
  for (const row of quoteSummaryRows(totals)) {
    if (row.prominent) { rule(ctx, y + 8, brand); y -= 8 }
    label(ctx, MARGIN + 250, y, row.title, row.prominent ? 12 : 9, row.prominent, row.prominent ? brandText : MUTED)
    right(ctx, COL.sum, y, money(row.amount), row.prominent ? 12 : 9, row.prominent, row.prominent ? brandText : INK)
    y -= row.prominent ? 19 : 17
  }

  stampPdfBrand(doc)
  return doc.save()
}
