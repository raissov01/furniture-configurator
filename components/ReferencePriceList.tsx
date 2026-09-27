'use client'

import { t as tr } from '@/lib/i18n'
import { OWN_REFERENCE_PRICES, REFERENCE_PRICE_LIST_NAME } from '@/src/core/data/catalog'
import { formatTengeExact } from '@/src/core/pricing'

/** Тек анықтамалық. Бұл жолдар ShopProfile прайсына автоматты жазылмайды. */
export function ReferencePriceList() {
  return <details className="border border-neutral-300 p-3 text-xs dark:border-neutral-700">
    <summary className="cursor-pointer font-semibold">{tr(REFERENCE_PRICE_LIST_NAME)} · {OWN_REFERENCE_PRICES.length}</summary>
    <p className="mt-2 text-neutral-600 dark:text-neutral-400">
      {tr('Цены могут устареть. Это справочник поставщиков, а не прайс вашего цеха.')}
    </p>
    <div className="mt-2 max-h-64 overflow-auto">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead><tr className="border-b border-neutral-300 dark:border-neutral-700">
          <th className="p-1">{tr('Материал / артикул')}</th>
          <th className="p-1">{tr('Цена и единица')}</th>
          <th className="p-1">{tr('Поставщик / город')}</th>
          <th className="p-1">{tr('Дата / источник')}</th>
        </tr></thead>
        <tbody>{OWN_REFERENCE_PRICES.map((row, index) => <tr key={`${row.targetId}:${row.url}:${index}`}
          className="border-b border-neutral-200 dark:border-neutral-800">
          <td className="p-1">{row.supplierName} · {row.supplierDecorCode}</td>
          <td className="p-1 tabular-nums">{row.priceType === 'from' ? `${tr('от')} ` : ''}{formatTengeExact(row.priceTiyn)} / {row.unit === 'sheet' ? tr('лист') : tr('п.м.')}</td>
          <td className="p-1">{row.supplier} · {row.city}</td>
          <td className="p-1">{row.dateSeen} · <a href={row.url} target="_blank" rel="noopener noreferrer" className="underline">{tr('Источник')}</a></td>
        </tr>)}</tbody>
      </table>
    </div>
  </details>
}
