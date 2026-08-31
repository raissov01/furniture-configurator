/**
 * Список фурнитуры — ЦЕХ оқитын құжат: не сатып алу керек.
 *
 * КП-дан екі айырмашылығы бар, екеуі де әдейі:
 *
 * 1. БАҒАСЫЗ ДА ШЫҒА БЕРЕДІ. КП-да толтырылмаған баға — тыйым (§6), себебі
 *    ойдан жазылған сан клиентке кетеді. Ал сатып алу тізімі цехтың өз
 *    ішіндегі қағаз: бағасы белгісіз позиция «—» болып тұрады да, тізім
 *    бәрібір пайдалы болып қалады.
 *
 * 2. ТЕХНИКА БӨЛЕК БӨЛІМДЕ, санымен, бірақ БАҒАСЫЗ. Оны клиент өзі алады;
 *    цехқа ол сатып алу емес, ҰЯ ҚАЛДЫРУ міндеті. Тізімнен мүлде алып
 *    тастасақ, цех оны ұмытып кетер еді.
 *
 * Күн сыртта беріледі: ядро жүйе сағатына тәуелді болмауы керек, әйтпесе
 * бірдей жобадан екі түрлі файл шығады да, тест жазу мүмкін болмайды.
 */

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import type { HardwarePlacement } from '../hardware'
import { countHardware, formatTenge } from '../pricing'
import type { HardwareItem, HardwareKind, ShopProfile } from '../shop'
import type { Panel } from '../types'
import type { PdfFonts } from './pdf'

export type HardwareListRow = {
  id: string
  name: string
  kind: HardwareKind
  qty: number
  unit: 'шт' | 'м'
  /** Бір дананың бағасы, тиын. 0 — цех әлі қоймаған. */
  unitPrice: number
  /** Жол сомасы, тиын. Бағасы жоқ болса 0. */
  cost: number
}

export type HardwareList = {
  rows: HardwareListRow[]
  /** Клиент өзі алатын техника: атауы мен саны, бағасы ЖОҚ. */
  appliances: { id: string; name: string; qty: number }[]
  /** Бағасы қойылған жолдардың сомасы, тиын. */
  total: number
  /** Бағасы қойылмаған позициялардың атаулары — қағазда ескерту болып шығады. */
  withoutPrice: string[]
}

/** Метрмен сатылатын позициялар. */
const BY_METRE = new Set(['rod-25', 'sliding-track'])

const KIND_ORDER: HardwareKind[] = [
  'hinge', 'runner', 'handle', 'leg', 'confirmat', 'minifix', 'dowel', 'shelfPin', 'other',
]

export const HARDWARE_KIND_NAMES: Record<HardwareKind, string> = {
  hinge: 'Петли',
  runner: 'Направляющие',
  handle: 'Ручки',
  leg: 'Опоры',
  confirmat: 'Конфирматы',
  minifix: 'Стяжки',
  dowel: 'Шканты',
  shelfPin: 'Полкодержатели',
  other: 'Прочее',
}

/**
 * Тізімнің өзі. Сан ПРИСАДКАДАН және орналасудан шығады — қолмен саналмайды,
 * сондықтан ол 3D-мен де, сметамен де ешқашан алшақтамайды.
 */
export function hardwareList(
  panels: Panel[],
  placements: HardwarePlacement[],
  shop: ShopProfile,
): HardwareList {
  const byId = new Map<string, HardwareItem>(shop.hardware.map((h) => [h.id, h]))
  const counts = countHardware(panels)

  const appliances: { id: string; name: string; qty: number }[] = []
  for (const item of placements) {
    if (!item.priced) {
      // Техника: санаймыз, бірақ сатып алу тізіміне ҚОСПАЙМЫЗ.
      const found = appliances.find((a) => a.id === item.hardwareId)
      if (found) found.qty += item.qty
      else appliances.push({ id: item.hardwareId, name: item.label, qty: item.qty })
      continue
    }
    const add = item.length > 0 ? item.length / 1000 : item.qty
    counts.set(item.hardwareId, (counts.get(item.hardwareId) ?? 0) + add)
  }

  const withoutPrice: string[] = []
  const rows: HardwareListRow[] = [...counts]
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = byId.get(id)
      const name = item?.name ?? id
      const unitPrice = item?.pricePerUnit ?? 0
      if (unitPrice <= 0) withoutPrice.push(name)
      return {
        id,
        name,
        kind: item?.kind ?? 'other',
        qty: Math.round(qty * 100) / 100,
        unit: (BY_METRE.has(id) ? 'м' : 'шт') as 'шт' | 'м',
        unitPrice,
        cost: Math.round((qty * unitPrice) / 100) * 100,
      }
    })
    .sort((a, b) => {
      const ka = KIND_ORDER.indexOf(a.kind)
      const kb = KIND_ORDER.indexOf(b.kind)
      if (ka !== kb) return ka - kb
      return a.name.localeCompare(b.name, 'ru')
    })

  return {
    rows,
    appliances,
    total: rows.reduce((sum, r) => sum + r.cost, 0),
    withoutPrice: [...new Set(withoutPrice)],
  }
}

/** Сатып алуға арналған CSV: жеткізушіге жіберуге ыңғайлы. */
export function hardwareListToCsv(list: HardwareList): string {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [['Группа', 'Наименование', 'Кол-во', 'Ед', 'Цена, ₸', 'Сумма, ₸'].join(';')]
  for (const r of list.rows) {
    lines.push([
      esc(HARDWARE_KIND_NAMES[r.kind]),
      esc(r.name),
      String(r.qty),
      r.unit,
      r.unitPrice > 0 ? String(Math.round(r.unitPrice / 100)) : '',
      r.cost > 0 ? String(Math.round(r.cost / 100)) : '',
    ].join(';'))
  }
  for (const a of list.appliances) {
    // Техника — клиенттікі: баған бос қалады, ал жол қағазда тұрады.
    lines.push([esc('Техника заказчика'), esc(a.name), String(a.qty), 'шт', '', ''].join(';'))
  }
  return lines.join('\n')
}

// ── PDF ──────────────────────────────────────────────────────────────────────

const PAGE = { w: 595, h: 842 }
const MARGIN = 40
const INK = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.45, 0.45, 0.5)
const RULE = rgb(0.8, 0.8, 0.84)

/**
 * PDF-те валюта «тг» деп жазылады: құжатқа енетін қаріп жиынтығында ₸ (U+20B8)
 * ЖОҚ, ал жоқ таңба үнсіз түсіп қалады.
 */
const money = (minor: number) => formatTenge(minor, 'тг')

const COL = { qty: 340, unit: 380, price: 460, sum: PAGE.w - MARGIN }

export type HardwareListPdfInput = {
  list: HardwareList
  shop: ShopProfile
  projectName: string
  /** Құжаттағы күн, дайын жол күйінде (мысалы «31.08.2026»). */
  date: string
  fonts: PdfFonts
}

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont }

function label(ctx: Ctx, x: number, y: number, v: string, size = 9, bold = false, color = INK): void {
  ctx.page.drawText(v, { x, y, size, font: bold ? ctx.bold : ctx.regular, color })
}

function right(ctx: Ctx, xRight: number, y: number, v: string, size = 9, bold = false, color = INK): void {
  const font = bold ? ctx.bold : ctx.regular
  ctx.page.drawText(v, { x: xRight - font.widthOfTextAtSize(v, size), y, size, font, color })
}

export async function hardwareListPdf(input: HardwareListPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(input.fonts.regular, { subset: true })
  const bold = await doc.embedFont(input.fonts.bold, { subset: true })

  let page = doc.addPage([PAGE.w, PAGE.h])
  let ctx: Ctx = { page, regular, bold }
  let y = PAGE.h - MARGIN

  const need = (space: number): void => {
    if (y - space > MARGIN) return
    page = doc.addPage([PAGE.w, PAGE.h])
    ctx = { page, regular, bold }
    y = PAGE.h - MARGIN
  }

  label(ctx, MARGIN, y, 'Список фурнитуры', 16, true)
  right(ctx, PAGE.w - MARGIN, y, input.date, 9, false, MUTED)
  y -= 22

  const shopLine = [input.shop.name, input.shop.city, input.shop.phone].filter(Boolean).join(' · ')
  if (shopLine) {
    label(ctx, MARGIN, y, shopLine, 9, false, MUTED)
    y -= 14
  }
  label(ctx, MARGIN, y, `Проект: ${input.projectName}`, 10)
  y -= 20

  label(ctx, MARGIN, y, 'Наименование', 8, true, MUTED)
  right(ctx, COL.unit, y, 'Кол-во', 8, true, MUTED)
  right(ctx, COL.price, y, 'Цена', 8, true, MUTED)
  right(ctx, COL.sum, y, 'Сумма', 8, true, MUTED)
  y -= 6
  ctx.page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, color: RULE, thickness: 0.6 })
  y -= 12

  let group: HardwareKind | null = null
  for (const r of input.list.rows) {
    need(30)
    if (r.kind !== group) {
      group = r.kind
      label(ctx, MARGIN, y, HARDWARE_KIND_NAMES[r.kind].toUpperCase(), 8, true, MUTED)
      y -= 12
    }
    label(ctx, MARGIN + 8, y, r.name, 9)
    right(ctx, COL.unit, y, `${r.qty} ${r.unit}`, 9, false, MUTED)
    // Бағасы жоқ позиция «—» болып тұрады: тізім бәрібір керек.
    right(ctx, COL.price, y, r.unitPrice > 0 ? money(r.unitPrice) : '—', 9, false, MUTED)
    right(ctx, COL.sum, y, r.cost > 0 ? money(r.cost) : '—', 9)
    y -= 13
  }

  if (input.list.appliances.length > 0) {
    need(50)
    y -= 8
    label(ctx, MARGIN, y, 'ТЕХНИКА ЗАКАЗЧИКА', 8, true, MUTED)
    y -= 12
    label(ctx, MARGIN, y, 'Цех её не покупает — нужно оставить нишу указанного размера.', 8, false, MUTED)
    y -= 14
    for (const a of input.list.appliances) {
      need(20)
      label(ctx, MARGIN + 8, y, a.name, 9)
      right(ctx, COL.unit, y, `${a.qty} шт`, 9, false, MUTED)
      y -= 13
    }
  }

  need(40)
  y -= 8
  ctx.page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, color: RULE, thickness: 0.6 })
  y -= 14
  label(ctx, MARGIN, y, 'Итого фурнитуры', 10, true)
  right(ctx, COL.sum, y, money(input.list.total), 10, true)
  y -= 16

  if (input.list.withoutPrice.length > 0) {
    need(30)
    label(
      ctx, MARGIN, y,
      `Без цены: ${input.list.withoutPrice.join(', ')}`,
      8, false, MUTED,
    )
  }

  return doc.save()
}
