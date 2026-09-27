'use client'

/**
 * ПРАЙС-ЛИСТ — докинг панелі (docs/pro100/ui-design.md §2).
 *
 * Смета есебі толық дайын: `src/core/nesting.ts` (`nestPanels`) пен
 * `src/core/pricing.ts` (`priceProject`) — дәл сол функцияларды
 * `components/QuoteView.tsx` те қолданады. Бұл панель QuoteView-ді
 * ҚАЙТА ЖАЗБАЙДЫ, тек ЕКІНШІ, тар докинг терезесіне сыятын көрінісін
 * шығарады (QuoteView өзі — жобаның толық сметасы, қалқымалы модаль,
 * бұл екеуін ажырату себебі: докинг панелінің ені 220 мм-ден басталады,
 * QuoteView-дің кестесі оған сыймайды). Толық смета мен экспорт түймелері
 * керек болса — төмендегі «Толық смета» батырмасы бар QuoteView-ді ашады
 * (`store.setQuoteOpen`, жаңа action ЖОҚ, бар).
 */
import { useMemo } from 'react'
import { t as tr } from '@/lib/i18n'
import {
  formatTenge, nestPanels, nestingOptionsOf, priceProject,
} from '@/src/core/index'
import type { NestingResult, PriceBreakdown } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { useProjectProduction } from '@/lib/useProjectProduction'
import { nestingSummary, priceGroups, uniqueMissingPrices } from './priceSummary'

export function PricePanel() {
  const shop = useConfigurator((s) => s.shop)
  const priceOverrides = useConfigurator((s) => s.priceOverrides)
  const setQuoteOpen = useConfigurator((s) => s.setQuoteOpen)

  const { panels, hardware, moduleWidths, specialParts, catalog, error: generationError } = useProjectProduction()

  const [nestingError, nesting]: [string | null, NestingResult | null] = useMemo(() => {
    if (panels.length === 0 && specialParts.length === 0) return [null, null]
    try {
      return [null, nestPanels(panels, catalog, nestingOptionsOf(shop))]
    } catch (error) {
      return [error instanceof Error ? error.message : String(error), null]
    }
  }, [panels, specialParts, catalog, shop])

  const [priceError, price]: [string | null, PriceBreakdown | null] = useMemo(() => {
    if (!nesting) return [null, null]
    try {
      return [null, priceProject(panels, nesting, shop, hardware, moduleWidths, priceOverrides, specialParts)]
    } catch (err) {
      return [err instanceof Error ? err.message : String(err), null]
    }
  }, [panels, nesting, shop, hardware, moduleWidths, priceOverrides, specialParts])

  const error = generationError ?? nestingError ?? priceError
  if (error) {
    return <div data-panel="price" role="alert" className="border border-red-900 bg-red-950 px-2 py-1 text-xs text-red-300">{error}</div>
  }

  if (panels.length === 0 && specialParts.length === 0) {
    return (
      <div data-panel="price" className="text-[11px] text-neutral-500">
        {tr('Нет деталей для раскроя.')}
      </div>
    )
  }

  const missing = price ? uniqueMissingPrices(price) : []
  const groups = price
    ? priceGroups(price, {
        materials: tr('Материалы'),
        edges: tr('Кромка'),
        hardware: tr('Фурнитура'),
        services: tr('Услуги цеха'),
      })
    : []

  return (
    <div data-panel="price" className="flex flex-col gap-2.5 text-[11px]">
      <div className="flex flex-wrap gap-1.5">
        {nesting ? (
          <span className="rounded border border-neutral-800 px-1.5 py-0.5 text-neutral-300">
            {tr('Листов всего')}: <b className="tabular-nums">{nesting.sheetCount}</b>
          </span>
        ) : null}
        {nesting ? nestingSummary(nesting).map((m) => (
          <span key={m.materialId} className="rounded border border-neutral-800 px-1.5 py-0.5 text-neutral-400" title={m.materialName}>
            {m.materialName}: <span className="tabular-nums">{m.sheets} {tr('л')} · {m.wastePercent.toFixed(1)}%</span>
          </span>
        )) : null}
      </div>

      {nesting && nesting.unplaced.length > 0 ? (
        <div className="border border-red-900 bg-red-950/40 px-1.5 py-1 text-red-300">
          {tr('Не помещаются на лист')}: {nesting.unplaced.map((u) => u.label).join(', ')}
        </div>
      ) : null}

      {priceError ? (
        <div className="border border-red-900 bg-red-950/40 px-1.5 py-1 text-red-300">{priceError}</div>
      ) : null}

      {missing.length > 0 ? (
        <div className="border border-amber-900 bg-amber-950/30 px-1.5 py-1 text-amber-300">
          {tr('Не заданы все цены')}: {missing.join('; ')}
        </div>
      ) : null}

      {price ? (
        <div className="flex flex-col gap-2 border-t border-neutral-800 pt-2">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{g.title}</div>
              {g.lines.map((l) => (
                <div key={l.id} className="flex items-baseline justify-between gap-2 text-neutral-300">
                  <span className="min-w-0 truncate">{l.name}</span>
                  <span className="shrink-0 tabular-nums text-neutral-500">{formatTenge(l.cost)}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="flex flex-col gap-0.5 border-t border-neutral-800 pt-1.5">
            <Row label={tr('Себестоимость')} value={formatTenge(price.subtotal)} />
            <Row label={`${tr('Наценка')} ${price.markupPercent}%`} value={formatTenge(price.markup)} />
            <div className="flex items-baseline justify-between border-t border-neutral-800 pt-1 font-semibold text-white">
              <span>{tr('Итого клиенту')}</span>
              <span className="tabular-nums">{formatTenge(price.total)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setQuoteOpen(true)}
        className="mt-1 self-start border border-neutral-700 px-2 py-1 text-neutral-300 hover:border-neutral-500 hover:text-white"
      >
        {tr('Открыть полную смету')}
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-neutral-300">
      <span className="text-neutral-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
