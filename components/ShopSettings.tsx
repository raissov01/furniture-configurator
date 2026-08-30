'use client'

/**
 * Цех профилі: материалдар, бағалар, зазорлар, фурнитура (SaaS негізі).
 *
 * Мұнда бір де бір «біздің цехта былай» деген сан кодта тұрмайды — бәрі осы
 * экраннан келеді. Жаңа цех тіркелгенде істейтіні: бағаларын енгізу.
 */

import { useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, shopReadiness } from '@/src/core/index'
import type { ConstructionSettings, ShopProfile } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { Button, Field, NumberInput, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'

type Tab = 'profile' | 'materials' | 'bands' | 'hardware' | 'rules'

const TABS: { value: Tab; label: string }[] = [
  { value: 'profile', label: 'Цех' },
  { value: 'materials', label: 'Материалы' },
  { value: 'bands', label: 'Кромки' },
  { value: 'hardware', label: 'Фурнитура' },
  { value: 'rules', label: 'Правила цеха' },
]

/** Баға ішінде ТИЫНМЕН сақталады, экранда теңгемен көрсетіледі. */
const toTenge = (minor: number) => Math.round(minor / 100)
const toMinor = (tenge: number) => Math.round(tenge) * 100

const text =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none ' +
  'focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300'

export function ShopSettings() {
  const open = useConfigurator((s) => s.shopOpen)
  const setOpen = useConfigurator((s) => s.setShopOpen)
  const shop = useConfigurator((s) => s.shop)
  const editShop = useConfigurator((s) => s.editShop)
  const [tab, setTab] = useState<Tab>('profile')

  const readiness = useMemo(() => shopReadiness(shop), [shop])

  if (!open) return null

  const setPriceSheet = (id: string, tenge: number) =>
    editShop({ materials: shop.materials.map((m) => (m.id === id ? { ...m, pricePerSheet: toMinor(tenge) } : m)) })
  const setSheet = (id: string, patch: { sheetWidth?: number; sheetHeight?: number }) =>
    editShop({ materials: shop.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const setBandPrice = (id: string, tenge: number) =>
    editShop({ edgeBands: shop.edgeBands.map((b) => (b.id === id ? { ...b, pricePerMeter: toMinor(tenge) } : b)) })
  const setHardwarePrice = (id: string, tenge: number) =>
    editShop({ hardware: shop.hardware.map((h) => (h.id === id ? { ...h, pricePerUnit: toMinor(tenge) } : h)) })
  const setRule = (key: keyof ConstructionSettings, value: number) =>
    editShop({ settings: { ...shop.settings, [key]: value } })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Настройки цеха</h2>
          {TABS.map((t) => (
            <Button key={t.value} active={tab === t.value} onClick={() => setTab(t.value)}>{t.label}</Button>
          ))}
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>Закрыть</Button>
          </div>
        </div>

        {!readiness.pricingReady ? (
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Пока не заданы цены, коммерческое предложение не выпускается: выдуманная цена уходит клиенту.
            Достаточно заполнить те материалы, с которыми вы реально работаете.
          </p>
        ) : null}

        {tab === 'profile' ? (
          <div className="space-y-3">
            <SectionTitle>Реквизиты — попадут в КП</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Название цеха">
                <input className={text} value={shop.name} placeholder="Цех «Алаш»"
                  onChange={(e) => editShop({ name: e.target.value })} />
              </Field>
              <Field label="Город">
                <input className={text} value={shop.city} placeholder="Астана"
                  onChange={(e) => editShop({ city: e.target.value })} />
              </Field>
              <Field label="Телефон">
                <input className={text} value={shop.phone} placeholder="+7 ___ ___ __ __"
                  onChange={(e) => editShop({ phone: e.target.value })} />
              </Field>
            </div>
            <p className="text-[11px] text-neutral-400">
              Профиль хранится в этом браузере. Когда появятся аккаунты, он переедет на сервер как есть.
            </p>
          </div>
        ) : null}

        {tab === 'materials' ? (
          <PriceTable
            head={['Материал', 'Толщина', 'Лист, мм', 'Цена листа, ₸']}
            rows={shop.materials.map((m) => ({
              id: m.id,
              name: m.name,
              cells: [
                <span key="t" className="tabular-nums text-neutral-500">{m.thickness}</span>,
                <span key="s" className="flex items-center gap-1">
                  <NumberInput value={m.sheetWidth} min={500} step={10}
                    onChange={(sheetWidth) => setSheet(m.id, { sheetWidth })} />
                  <NumberInput value={m.sheetHeight} min={500} step={10}
                    onChange={(sheetHeight) => setSheet(m.id, { sheetHeight })} />
                </span>,
                <NumberInput key="p" value={toTenge(m.pricePerSheet)} min={0} step={100}
                  invalid={m.pricePerSheet <= 0}
                  onChange={(v) => setPriceSheet(m.id, v)} />,
              ],
            }))}
          />
        ) : null}

        {tab === 'bands' ? (
          <PriceTable
            head={['Кромка', 'Толщина', 'Цена за метр, ₸']}
            rows={shop.edgeBands.map((b) => ({
              id: b.id,
              name: b.name,
              cells: [
                <span key="t" className="tabular-nums text-neutral-500">{b.thickness}</span>,
                <NumberInput key="p" value={toTenge(b.pricePerMeter)} min={0} step={10}
                  onChange={(v) => setBandPrice(b.id, v)} />,
              ],
            }))}
          />
        ) : null}

        {tab === 'hardware' ? (
          <PriceTable
            head={['Позиция', 'Цена за штуку, ₸']}
            rows={shop.hardware.map((h) => ({
              id: h.id,
              name: h.name,
              cells: [
                <NumberInput key="p" value={toTenge(h.pricePerUnit)} min={0} step={10}
                  onChange={(v) => setHardwarePrice(h.id, v)} />,
              ],
            }))}
          />
        ) : null}

        {tab === 'rules' ? (
          <div className="space-y-3">
            <SectionTitle>Как собирает ваш цех, мм</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <Rule label="Зазор полки" hint="общий, на обе стороны" k="shelfGap" shop={shop} onChange={setRule} />
              <Rule label="Отступ полки от фронта" k="shelfSetback" shop={shop} onChange={setRule} />
              <Rule label="Зазор фасадов" k="frontGap" shop={shop} onChange={setRule} />
              <Rule label="Толщина задней стенки" k="backThickness" shop={shop} onChange={setRule} />
              <Rule label="Глубина паза" k="grooveDepth" shop={shop} onChange={setRule} />
              <Rule label="Отступ паза от края" k="grooveInset" shop={shop} onChange={setRule} />
              <Rule label="Кромка вычитается от" hint="0.4 обычно не вычитается" k="minBandSubtract" shop={shop} onChange={setRule} />
              <Rule label="3-й конфирмат при длине" k="confirmatSpanForThird" shop={shop} onChange={setRule} />
              <Rule label="Первое отверстие полкодержателя" k="shelfPinDatum" shop={shop} onChange={setRule} />
            </div>

            <SectionTitle>Предел прогиба полки</SectionTitle>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Максимальный пролёт полки, мм" hint={shop.maxShelfSpan === null ? 'выключено' : undefined}>
                <NumberInput
                  value={shop.maxShelfSpan ?? 0}
                  min={0}
                  step={10}
                  onChange={(v) => editShop({ maxShelfSpan: v > 0 ? v : null })}
                />
              </Field>
              <Button onClick={() => editShop({ maxShelfSpan: null })} disabled={shop.maxShelfSpan === null}>
                Выключить
              </Button>
            </div>
            <p className="max-w-2xl text-[11px] leading-snug text-neutral-400">
              Значения по умолчанию здесь нет намеренно. Предел зависит от материала, толщины и того,
              что кладут на полку — один цех ставит 800 мм, другой 900. Пока поле пустое, предупреждение
              не показывается вовсе.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Rule({
  label, hint, k, shop, onChange,
}: {
  label: string
  hint?: string
  k: keyof ConstructionSettings
  shop: ShopProfile
  onChange: (k: keyof ConstructionSettings, v: number) => void
}) {
  const value = shop.settings[k] ?? DEFAULT_SETTINGS[k]
  const overridden = shop.settings[k] !== undefined
  return (
    <Field label={label} hint={hint ?? (overridden ? 'своё' : `по умолчанию ${DEFAULT_SETTINGS[k]}`)}>
      <NumberInput value={value} min={0} step={1} onChange={(v) => onChange(k, v)} />
    </Field>
  )
}

function PriceTable({
  head, rows,
}: {
  head: string[]
  rows: { id: string; name: string; cells: React.ReactNode[] }[]
}) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2.5 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={cn(i % 2 === 1 && 'bg-neutral-50/60 dark:bg-neutral-950/40')}>
              <td className="px-2.5 py-1.5">{r.name}</td>
              {r.cells.map((c, k) => (
                <td key={k} className="px-2.5 py-1.5">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
