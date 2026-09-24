'use client'

/**
 * Раскрой мен смета (§5, §6).
 *
 * Есеп БҮКІЛ ЖОБА бойынша жүреді, тек ашық тұрған шкаф бойынша емес: цех
 * парақты да, кромканы да бүкіл тапсырысқа бірге сатып алады.
 *
 * Мұнда бірде бір сан ЕСЕПТЕЛМЕЙДІ — бәрі ядродан келеді (`nestPanels`,
 * `priceProject`), сондықтан экрандағы сан мен экспорттағы сан ажырамайды.
 */

import { t as tr } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import {
  SERVICE_IDS, SERVICE_NAMES, formatTenge, formatTengeExact, nestPanels, nestingOptionsOf, priceProject,
} from '@/src/core/index'
import type { Discount, HardwarePlacement, NestedSheet, Panel, PriceLine, PriceOverrides } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

type Tab = 'nesting' | 'price'

/** Парақ сызбасының экрандағы ені, пиксель. */
const SHEET_PX = 460

/** Қаріп pdf-lib-ке сырттан беріледі: стандарт қаріптері кириллицаны білмейді. */
async function loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const [regular, bold] = await Promise.all([
    fetch('/fonts/DejaVuSans-subset.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/DejaVuSans-Bold-subset.ttf').then((r) => r.arrayBuffer()),
  ])
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) }
}

function download(filename: string, data: Uint8Array | string, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** ISO (YYYY-MM-DD) → «ДД.ММ.ГГГГ», КП-дағы басқа даталармен бір пішінде. */
function isoToRu(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

/** `panels` — БҮКІЛ ЖОБАНЫҢ детальдары. Геометрия store-да есептелмейді (§3). */
export function QuoteView({
  panels, hardware, projectName, moduleWidths,
}: {
  panels: Panel[]
  /** Панель емес фурнитура: штанга мен ұстағыштар. */
  hardware: HardwarePlacement[]
  projectName: string
  /** Корпустардың ені, мм — монтаж мөлшерлемесі осыдан саналады. */
  moduleWidths: number[]
}) {
  const open = useConfigurator((s) => s.quoteOpen)
  const setOpen = useConfigurator((s) => s.setQuoteOpen)
  const shop = useConfigurator((s) => s.shop)
  const catalog = useConfigurator((s) => s.catalog)
  // Тапсырыс реквизиттері («Проект» терезесінің «Реквизиты» қойындысы) — КП-ға
  // солардан барады. «Заказчик» өрісі осы жерде әлі де қолмен түзетілуі мүмкін.
  const projectInfo = useConfigurator((s) => s.projectInfo)
  // Баға түзетулері (qdesign паритеті): коэффициент/сату бағасын осы жобаға ғана ауыстыру.
  const priceOverrides = useConfigurator((s) => s.priceOverrides)
  const editPriceOverrides = useConfigurator((s) => s.editPriceOverrides)
  const [tab, setTab] = useState<Tab>('nesting')
  const [customer, setCustomer] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const nesting = useMemo(() => {
    try {
      return nestPanels(panels, catalog, nestingOptionsOf(shop))
    } catch {
      return null
    }
  }, [panels, catalog, shop])

  // Жарамсыз override (теріс/0 коэффициент, теріс сату бағасы) ConfigValidationError
  // лақтырады — экранда есептеу кезінде ұстап, хабарды көрсетеміз, апп құламауы керек.
  const [priceError, price] = useMemo((): [string | null, ReturnType<typeof priceProject> | null] => {
    if (!nesting) return [null, null]
    try {
      return [null, priceProject(panels, nesting, shop, hardware, moduleWidths, priceOverrides)]
    } catch (err) {
      return [err instanceof Error ? err.message : String(err), null]
    }
  }, [panels, nesting, shop, hardware, moduleWidths, priceOverrides])

  const run = async (kind: string, action: () => Promise<void>) => {
    setBusy(kind)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">{tr('Смета по проекту')}</h2>
          <Button active={tab === 'nesting'} onClick={() => setTab('nesting')}>{tr('Раскрой')}</Button>
          <Button active={tab === 'price'} onClick={() => setTab('price')}>{tr('Стоимость')}</Button>
          <span className="text-[11px] text-neutral-400">
            {panels.length > 0 ? `деталей в проекте: ${panels.length}` : null}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              disabled={busy !== null || !nesting}
              title={tr('Карта раскроя для цеха, по листу на страницу')}
              onClick={() => void run('map', async () => {
                const { nestingPdf } = await import('@/src/core/export/nestingPdf')
                const bytes = await nestingPdf({ nesting: nesting!, projectName, fonts: await loadFonts() })
                download(`${projectName}-раскрой.pdf`, bytes, 'application/pdf')
              })}
            >
              {busy === 'map' ? '…' : 'PDF карты'}
            </Button>
            <Button
              disabled={busy !== null || !nesting}
              title={tr('По одному DXF на лист, всё в архиве')}
              onClick={() => void run('dxf', async () => {
                const [{ nestingToDxfFiles }, { zipSync, strToU8 }] = await Promise.all([
                  import('@/src/core/export/dxf'),
                  import('fflate'),
                ])
                const entries: Record<string, Uint8Array> = {}
                for (const [name, content] of nestingToDxfFiles(nesting!)) entries[name] = strToU8(content)
                download(`${projectName}-раскрой-dxf.zip`, zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }), 'application/zip')
              })}
            >
              {busy === 'dxf' ? '…' : 'DXF'}
            </Button>
            <Button
              disabled={busy !== null || !price || price.missingPrices.length > 0}
              title={
                priceError
                  ? priceError
                  : price && price.missingPrices.length > 0
                    ? 'Пока не заданы все цены, КП выпускать нельзя'
                    : 'Коммерческое предложение для клиента'
              }
              onClick={() => void run('quote', async () => {
                const { quotePdf } = await import('@/src/core/export/quotePdf')
                const orderDate = projectInfo.date ? isoToRu(projectInfo.date) : new Date().toLocaleDateString('ru-RU')
                const client = customer.trim() || projectInfo.client
                const bytes = await quotePdf({
                  price: price!, shop, projectName,
                  date: orderDate,
                  ...(client ? { customer: client } : {}),
                  ...(projectInfo.orderNo ? { orderNo: projectInfo.orderNo } : {}),
                  ...(projectInfo.designer ? { designer: projectInfo.designer } : {}),
                  ...(projectInfo.note ? { note: projectInfo.note } : {}),
                  fonts: await loadFonts(),
                })
                download(`${projectName}-КП.pdf`, bytes, 'application/pdf')
              })}
            >
              {busy === 'quote' ? '…' : 'КП'}
            </Button>
            <Button
              disabled={busy !== null}
              title={tr('Что закупить в цех. Выпускается и без заполненных цен')}
              onClick={() => void run('fittings', async () => {
                const { hardwareList, hardwareListPdf } = await import('@/src/core/export/hardwareList')
                const list = hardwareList(panels, hardware, shop)
                const bytes = await hardwareListPdf({
                  list, shop, projectName,
                  date: new Date().toLocaleDateString('ru-RU'),
                  fonts: await loadFonts(),
                })
                download(`${projectName}-фурнитура.pdf`, bytes, 'application/pdf')
              })}
            >
              {busy === 'fittings' ? '…' : 'Фурнитура'}
            </Button>
            <Button
              disabled={busy !== null}
              title={tr('Список фурнитуры в CSV — отправить поставщику')}
              onClick={() => void run('fittings-csv', async () => {
                const { hardwareList, hardwareListToCsv } = await import('@/src/core/export/hardwareList')
                const csv = hardwareListToCsv(hardwareList(panels, hardware, shop))
                // BOM: Excel онсыз кириллицаны бұзып ашады.
                download(
                  `${projectName}-фурнитура.csv`,
                  new TextEncoder().encode(`\ufeff${csv}`),
                  'text/csv;charset=utf-8',
                )
              })}
            >
              {busy === 'fittings-csv' ? '…' : 'Фурнитура CSV'}
            </Button>
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {!nesting ? (
          <p className="text-xs text-neutral-500">{tr('Нет деталей для раскроя.')}</p>
        ) : tab === 'nesting' ? (
          <div className="space-y-4">
            {nesting.unplaced.length > 0 ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                Не помещаются на лист: {nesting.unplaced.map((u) => `${u.label} (${u.reason})`).join('; ')}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 text-xs">
              <Chip label={tr('Листов всего')} value={String(nesting.sheetCount)} />
              {nesting.byMaterial.map((m) => (
                <Chip
                  key={m.materialId}
                  label={m.materialName}
                  value={`${m.sheets.length} л · отход ${m.wastePercent.toFixed(1)}%`}
                />
              ))}
            </div>

            {nesting.byMaterial.map((m) => (
              <div key={m.materialId} className="space-y-2">
                <h3 className="text-xs font-semibold">{m.materialName}</h3>
                <div className="flex flex-wrap gap-3">
                  {m.sheets.map((sheet) => (
                    <SheetPlan key={sheet.index} sheet={sheet} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">{tr('Заказчик')}</span>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder={projectInfo.client || tr('имя клиента — попадёт в КП')}
                className="w-64 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            {projectInfo.orderNo || projectInfo.designer || projectInfo.note ? (
              <p className="text-[11px] text-neutral-400">
                {tr('В КП также попадут реквизиты из «Проект → Реквизиты»')}
                {projectInfo.orderNo ? ` · ${tr('Заказ')} ${projectInfo.orderNo}` : ''}
                {projectInfo.designer ? ` · ${tr('Дизайнер')} ${projectInfo.designer}` : ''}
              </p>
            ) : null}
            <PriceOverridesEditor overrides={priceOverrides} onChange={editPriceOverrides} shopCoefficient={shop.coefficient} />
            {priceError ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-2.5 py-2 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {priceError}
                {Object.keys(priceOverrides.lineDiscounts ?? {}).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.keys(priceOverrides.lineDiscounts ?? {}).map((key) => (
                      <Button key={key} onClick={() => {
                        const lineDiscounts = { ...priceOverrides.lineDiscounts }
                        delete lineDiscounts[key]
                        editPriceOverrides({ lineDiscounts })
                      }}>
                        {key}: {tr('убрать скидку')}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : price ? (
              <PriceTable price={price} shopName={shop.name} overrides={priceOverrides} onChange={editPriceOverrides} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] dark:border-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  )
}

/** Бір парақтың сызбасы. Подрезка нүктелі сызықпен, деталь аты мен өлшемімен. */
function SheetPlan({ sheet }: { sheet: NestedSheet }) {
  const scale = SHEET_PX / sheet.sheetWidth
  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}`}
        width={SHEET_PX}
        height={sheet.sheetHeight * scale}
        className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950"
        role="img"
        aria-label={`Лист ${sheet.index}`}
      >
        <rect
          x={sheet.usable.x} y={sheet.usable.y}
          width={sheet.usable.width} height={sheet.usable.height}
          fill="none" stroke="#94a3b8" strokeWidth={4} strokeDasharray="18 12"
        />
        {sheet.offcuts.map((o, i) => (
          <rect key={`o${i}`} x={o.x} y={o.y} width={o.width} height={o.height}
            fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeOpacity={0.5} strokeWidth={3} />
        ))}
        {sheet.parts.map((p) => (
          <g key={p.panelId}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height}
              fill="#e3c76a" stroke="#7c5f14" strokeWidth={4} />
            <text
              x={p.x + p.width / 2} y={p.y + p.height / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(34, Math.min(p.width, p.height) * 0.16)}
              fill="#3f3108"
            >
              {p.label} {p.width}×{p.height}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="text-[11px] text-neutral-500">
        Лист {sheet.index} · {sheet.sheetWidth}×{sheet.sheetHeight}
        {sheet.offcuts.length > 0 ? ` · деловой отход: ${sheet.offcuts.length}` : ''}
      </figcaption>
    </figure>
  )
}

/**
 * Баға түзетулерін (коэффициент/сату бағасы/жалпы жеңілдік) қолмен енгізу — qdesign
 * паритеті. Тек цехтың өз экранында, клиентке шықпайды.
 *
 * Коэффициент бос қалдырылса — цехтың әдепкісі (`shopCoefficient`)
 * қолданылады (`placeholder`-де көрінеді). Сату бағасы бос қалдырылса —
 * коэффициенттен шыққан сомамен есептеледі.
 */
function PriceOverridesEditor({
  overrides, onChange, shopCoefficient,
}: {
  overrides: PriceOverrides
  onChange: (patch: Partial<PriceOverrides>) => void
  shopCoefficient: number
}) {
  // Экранда теңгемен көрсетеді, сақтауда тиынмен (§0.2: ақша бүтін минор бірлік).
  const salePriceTenge = overrides.salePrice !== undefined ? (overrides.salePrice / 100).toFixed(2) : undefined

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 px-2.5 py-2 text-xs dark:border-neutral-700">
      <label className="flex flex-col gap-1">
        <span className="text-neutral-500">{tr('Коэффициент (этот проект)')}</span>
        <input
          type="number"
          step="0.1"
          min="0"
          value={overrides.coefficient ?? ''}
          placeholder={String(shopCoefficient)}
          onChange={(e) => {
            const raw = e.target.value
            onChange({ coefficient: raw === '' ? undefined : Number(raw) })
          }}
          className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-neutral-500">{tr('Цена продажи, ₸ (вручную)')}</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={salePriceTenge ?? ''}
          placeholder={tr('из коэффициента')}
          onChange={(e) => {
            const raw = e.target.value
            onChange({ salePrice: raw === '' ? undefined : Math.round(Number(raw) * 100) })
          }}
          className="w-36 rounded-md border border-neutral-300 bg-white px-2 py-1 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      {overrides.salePrice !== undefined ? (
        <Button onClick={() => onChange({ salePrice: undefined })}>
          {tr('Вернуться к коэффициенту')}
        </Button>
      ) : null}
      <DiscountInput
        label={tr('Скидка на весь проект')}
        discount={overrides.overallDiscount}
        onChange={(overallDiscount) => onChange({ overallDiscount })}
      />
    </div>
  )
}

function DiscountInput({ label, discount, onChange }: {
  label: string
  discount: Discount | undefined
  onChange: (discount: Discount | undefined) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-neutral-500">{label}</span>
      <span className="flex gap-1">
        <select
          aria-label={`${label}: тип`}
          value={discount?.kind ?? ''}
          onChange={(e) => {
            const kind = e.target.value
            onChange(kind === '' ? undefined : { kind: kind as Discount['kind'], value: 0 })
          }}
          className="rounded-md border border-neutral-300 bg-white px-1 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">—</option>
          <option value="percent">%</option>
          <option value="amount">₸</option>
        </select>
        {discount ? (
          <input
            aria-label={label}
            type="number"
            min="0"
            max={discount.kind === 'percent' ? 100 : undefined}
            step="0.01"
            value={discount.kind === 'amount' ? (discount.value / 100).toFixed(2) : discount.value}
            onChange={(e) => onChange({
              ...discount,
              value: discount.kind === 'amount' ? Math.round(Number(e.target.value) * 100) : Number(e.target.value),
            })}
            className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
          />
        ) : null}
      </span>
    </label>
  )
}

function PriceTable({ price, shopName, overrides, onChange }: {
  price: ReturnType<typeof priceProject>
  shopName: string
  overrides: PriceOverrides
  onChange: (patch: Partial<PriceOverrides>) => void
}) {
  const groups: { key: string; title: string; lines: PriceLine[] }[] = [
    { key: 'materials', title: tr('Материалы'), lines: price.materials },
    { key: 'edges', title: tr('Кромка'), lines: price.edges },
    { key: 'hardware', title: tr('Фурнитура'), lines: price.hardware },
    { key: 'services', title: tr('Услуги цеха'), lines: price.services },
  ]

  return (
    <div className="space-y-3">
      {price.missingPrices.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Не заданы цены — коммерческое предложение выпускать нельзя:{' '}
          {[...new Set(price.missingPrices)].join('; ')}. Заполните их во вкладке «Цех».
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Листы по материалам
        </div>
        <table className="w-full min-w-[620px] text-xs">
          <thead className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-1.5 font-medium">{tr('Материал')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Площадь')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Листы')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Материал')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Кромка')}</th>
              {SERVICE_IDS.map((sid) => (
                <th key={sid} className="py-1.5 text-right font-medium">{SERVICE_NAMES[sid]}</th>
              ))}
              <th className="py-1.5 text-right font-medium">{tr('Итого')}</th>
            </tr>
          </thead>
          <tbody>
            {price.byMaterial.map((r) => (
              <tr key={r.materialId} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1">{r.materialName}</td>
                <td className="py-1 text-right tabular-nums text-neutral-500">{r.areaSquareMetres} м²</td>
                <td className="py-1 text-right tabular-nums text-neutral-500">{r.sheets}</td>
                <td className="py-1 text-right tabular-nums">{formatTenge(r.materialCost)}</td>
                <td className="py-1 text-right tabular-nums">{formatTenge(r.edgeCost)}</td>
                {SERVICE_IDS.map((sid) => (
                  <td key={sid} className="py-1 text-right tabular-nums">{formatTenge(r.services[sid])}</td>
                ))}
                <td className="py-1 text-right tabular-nums font-medium">{formatTenge(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className="w-full text-xs">
        <thead className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="py-1.5 font-medium">{tr('Позиция')}</th>
            <th className="py-1.5 text-right font-medium">{tr('Кол-во')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Цена')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Сумма')}</th>
              <th className="py-1.5 text-right font-medium">{tr('Скидка')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) =>
            g.lines.length === 0 ? null : (
              <tr key={g.title} className="align-top">
                <td colSpan={5} className="pt-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {g.title}
                  </div>
                  <table className="w-full">
                    <tbody>
                      {g.lines.map((l) => {
                        const key = `${g.key}:${l.id}`
                        return <tr key={key} className="border-t border-neutral-100 dark:border-neutral-800">
                          <td className="py-1">{l.name}</td>
                          <td className="w-24 py-1 text-right tabular-nums text-neutral-500">
                            {l.qty} {l.unit}
                          </td>
                          <td className={cn('w-28 py-1 text-right tabular-nums', l.unitPrice <= 0 && 'text-amber-600')}>
                            {formatTenge(l.unitPrice)}
                          </td>
                          <td className="w-32 py-1 text-right tabular-nums font-medium">
                            {formatTenge(l.cost)}
                            {l.discountAmount ? <span className="block text-[10px] text-green-700">−{formatTengeExact(l.discountAmount)}</span> : null}
                          </td>
                          <td className="w-44 py-1 pl-2 text-right">
                            <DiscountInput
                              label={`${l.name}: скидка`}
                              discount={overrides.lineDiscounts?.[key]}
                              onChange={(discount) => {
                                const lineDiscounts = { ...overrides.lineDiscounts }
                                if (discount) lineDiscounts[key] = discount
                                else delete lineDiscounts[key]
                                onChange({ lineDiscounts })
                              }}
                            />
                          </td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <div className="ml-auto w-full max-w-sm space-y-1 border-t border-neutral-200 pt-2 text-xs dark:border-neutral-700">
        <Row label={tr('Материалы, кромка, фурнитура')} value={formatTenge(price.goods)} />
        <Row label={tr('Услуги цеха')} value={formatTenge(price.servicesTotal)} />
        {price.coefficientAmount !== 0 ? (
          <Row label={`Коэффициент ×${price.coefficient}`} value={formatTenge(price.coefficientAmount)} />
        ) : null}
        {price.installation.cost > 0 ? (
          <Row
            label={`Монтаж · ${price.installation.metres} м ширины`}
            value={formatTenge(price.installation.cost)}
          />
        ) : null}
        <Row label={tr('Себестоимость')} value={formatTenge(price.subtotal)} />
        <Row label={`Наценка ${price.markupPercent}%`} value={formatTenge(price.markup)} />
        {/*
          Толық смета — ТЕК цехтың өз экраны, сондықтан коэффициенттен шыққан
          сома мен қолмен қойылған сату бағасы екеуі де қатар көрінеді (qdesign
          паритеті). КП-да (quotePdf.ts) `salePriceOverride` бар болса
          себестоимость/наценка КӨРІНБЕЙДІ — тек түпкі баға (quoteTotalsView).
        */}
        <Row label={tr('Алдын ала сату бағасы')} value={formatTenge(price.calculatedTotal)} />
        {price.salePriceOverride !== undefined ? (
          <Row label={tr('Сату бағасы (қолмен)')} value={formatTengeExact(price.salePriceOverride)} />
        ) : null}
        <Row label="ВСЕГО" value={formatTengeExact(price.grossTotal)} />
        <Row label="СКИДКА" value={`−${formatTengeExact(price.discountTotal)}`} />
        <div className="flex items-baseline justify-between border-t border-neutral-200 pt-1.5 text-sm font-semibold dark:border-neutral-700">
          <span>К ОПЛАТЕ</span>
          <span className="tabular-nums">{formatTengeExact(price.total)}</span>
        </div>
        {shopName ? <p className="pt-1 text-[11px] text-neutral-400">{shopName}</p> : null}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
