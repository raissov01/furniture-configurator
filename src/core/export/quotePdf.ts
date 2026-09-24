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
import { formatTengeExact, quoteLineGroups, quoteTotalsView } from '../pricing'
import type { PriceBreakdown } from '../pricing'
import type { ShopProfile } from '../shop'
import { projectInfoRows } from './pdf'
import type { PdfFonts } from './pdf'

/** A4 портрет, пункт. */
const PAGE = { w: 595, h: 842 }
const MARGIN = 40
const INK = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.45, 0.45, 0.5)
const RULE = rgb(0.8, 0.8, 0.84)

/**
 * PDF-те валюта «тг» деп жазылады: құжатқа енетін қаріп жиынтығында ₸ (U+20B8)
 * ЖОҚ, ал жоқ таңба үнсіз түсіп қалады — клиент валютасы көрсетілмеген КП алады.
 */
const CURRENCY = 'тг'
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

const COL = { qty: 300, unit: 360, price: 430, sum: PAGE.w - MARGIN }

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

  label(ctx, MARGIN, y, 'Коммерческое предложение', 16, true)
  right(ctx, PAGE.w - MARGIN, y, input.date, 9, false, MUTED)
  y -= 22

  const shopLine = [input.shop.name, input.shop.city, input.shop.phone].filter(Boolean).join(' · ')
  if (shopLine) {
    label(ctx, MARGIN, y, shopLine, 9, false, MUTED)
    y -= 14
  }
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

  const groups = quoteLineGroups(input.price)
  if (groups.length > 0) {
    y -= 8
    label(ctx, MARGIN, y, 'Позиция', 8, true, MUTED)
    right(ctx, COL.unit, y, 'Кол-во', 8, true, MUTED)
    right(ctx, COL.price, y, 'Цена', 8, true, MUTED)
    right(ctx, COL.sum, y, 'Сумма', 8, true, MUTED)
    y -= 6
    rule(ctx, y)
    y -= 14
  }

  for (const group of groups) {
    if (group.lines.length === 0) continue
    need(40)
    label(ctx, MARGIN, y, group.title, 8, true, MUTED)
    y -= 13
    for (const line of group.lines) {
      need(24)
      label(ctx, MARGIN, y, line.name, 9)
      right(ctx, COL.unit, y, `${line.qty} ${line.unit}`, 9, false, MUTED)
      right(ctx, COL.price, y, money(line.unitPrice), 9, false, MUTED)
      right(ctx, COL.sum, y, money(line.cost), 9)
      y -= 13
      if (line.discountAmount) {
        need(24)
        label(ctx, MARGIN + 12, y, 'Скидка', 8, false, MUTED)
        right(ctx, COL.sum, y, `-${money(line.discountAmount)}`, 8, false, MUTED)
        y -= 13
      }
    }
    y -= 4
  }

  need(105)
  y -= 4
  rule(ctx, y)
  y -= 16
  /*
   * `quoteTotalsView`: қолмен қойылған сату бағасы (`salePriceOverride`)
   * бар жобада себестоимость пен коэффициент КЛИЕНТКЕ КӨРІНБЕЙДІ (qdesign
   * «Предложение клиенту» — тек түпкі баға). Толық жіктеме цехтың өз
   * экранында (`QuoteView.tsx`) әрдайым көрінеді, мұнда — тек осы шарт
   * орындалғанда.
   */
  const totals = quoteTotalsView(input.price)
  if (totals.kind === 'breakdown') {
    label(ctx, MARGIN + 260, y, 'Себестоимость', 9, false, MUTED)
    right(ctx, COL.sum, y, money(totals.subtotal), 9)
    y -= 14
    label(ctx, MARGIN + 260, y, `Наценка ${totals.markupPercent}%`, 9, false, MUTED)
    right(ctx, COL.sum, y, money(totals.markup), 9)
    y -= 8
    rule(ctx, y, MUTED)
    y -= 18
  }
  label(ctx, MARGIN + 260, y, 'ВСЕГО', 9, true)
  right(ctx, COL.sum, y, money(totals.grossTotal), 9, true)
  y -= 15
  label(ctx, MARGIN + 260, y, 'СКИДКА', 9, false, MUTED)
  right(ctx, COL.sum, y, `-${money(totals.discount)}`, 9, false, MUTED)
  y -= 8
  rule(ctx, y, MUTED)
  y -= 18
  label(ctx, MARGIN + 260, y, 'К ОПЛАТЕ', 12, true)
  right(ctx, COL.sum, y, money(totals.total), 12, true)

  return doc.save()
}
