'use client'

import { useMemo, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { defaultPriceColumnMap, canApplyPricePreview } from '@/lib/priceImportUi'
import { validatedShopEdit } from '@/lib/validatedShopEdit'
import { ownCatalogBuild } from '@/src/core/data/catalog'
import {
  applyPriceImport, parsePriceFile, previewPriceImport, priceCodesFromOwnCatalog, priceTargetsFromShop,
} from '@/src/core/priceImport'
import type { PriceColumnMap, PriceTable } from '@/src/core/priceImport'
import type { ShopProfile } from '@/src/core/shop'
import { useConfigurator } from '@/store/configurator'

const columns: Array<{ key: keyof PriceColumnMap; title: string }> = [
  { key: 'kind', title: 'Категория' }, { key: 'code', title: 'Артикул' },
  { key: 'name', title: 'Наименование' }, { key: 'brand', title: 'Бренд' },
  { key: 'thickness', title: 'Толщина, мм' }, { key: 'widthMm', title: 'Ширина кромки, мм' },
  { key: 'sheetWidth', title: 'Ширина листа, мм' }, { key: 'sheetHeight', title: 'Высота листа, мм' },
  { key: 'price', title: 'Цена, ₸' }, { key: 'unit', title: 'Единица' },
]

export function PriceImportPanel({ shop }: { shop: ShopProfile }) {
  const setShop = useConfigurator((s) => s.setShop)
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; format: 'csv' | 'xlsx' } | null>(null)
  const [encoding, setEncoding] = useState<'utf-8' | 'windows-1251'>('utf-8')
  const [map, setMap] = useState<Partial<PriceColumnMap>>({})
  const [targetId, setTargetId] = useState(shop.activePriceListId)
  const [approved, setApproved] = useState<number[]>([])
  const [feedback, setFeedback] = useState('')

  const parsed = useMemo((): { table?: PriceTable; error?: string } => {
    if (!file) return {}
    try { return { table: parsePriceFile(file.bytes, file.format, { csvEncoding: encoding }) } }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) } }
  }, [file, encoding])
  const effectiveMap = useMemo(() => Object.keys(map).length ? map : defaultPriceColumnMap(parsed.table?.headers ?? []), [map, parsed.table])
  const preview = useMemo(() => {
    if (!parsed.table) return null
    try {
      const own = ownCatalogBuild()
      const codes = priceCodesFromOwnCatalog(own.materialMeta, own.edgeMeta)
      return { value: previewPriceImport(parsed.table, effectiveMap as PriceColumnMap, priceTargetsFromShop(shop, codes)) }
    } catch (error) { return { error: error instanceof Error ? error.message : String(error) } }
  }, [parsed.table, effectiveMap, shop])
  const value = preview?.value

  return <section className="space-y-3 border border-neutral-300 p-3 text-xs dark:border-neutral-700">
    <h3 className="font-semibold">{tr('Импорт прайса CSV/XLSX')}</h3>
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="block">{tr('Файл прайса')}
        <span className="mt-1 flex items-center gap-2"><span className="border border-neutral-400 bg-white px-2 py-1 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100">{tr('Выбрать файл')}</span><span className="min-w-0 truncate">{file?.name ?? tr('Файл не выбран')}</span></span>
        <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={async (event) => {
            const selected = event.currentTarget.files?.[0]
            setFile(null); setMap({}); setApproved([]); setFeedback('')
            if (!selected) return
            const format = selected.name.toLowerCase().endsWith('.csv') ? 'csv'
              : selected.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : null
            if (!format) { setFeedback(tr('Выберите CSV или XLSX файл')); return }
            if (selected.size > 5_000_000) { setFeedback(tr('Файл прайса') + ': 5 МБ'); return }
            try { setFile({ name: selected.name, bytes: new Uint8Array(await selected.arrayBuffer()), format }) }
            catch (error) { setFeedback(error instanceof Error ? error.message : String(error)) }
          }} />
      </label>
      <label className="block">{tr('Кодировка CSV')}
        <select value={encoding} disabled={file?.format === 'xlsx'} onChange={(event) => { setEncoding(event.target.value as typeof encoding); setMap({}); setApproved([]) }}
          className="block w-full border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="utf-8">UTF-8</option><option value="windows-1251">Windows-1251</option>
        </select>
      </label>
      <label className="block">{tr('Целевой прайс-лист')}
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)}
          className="block w-full border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          {shop.priceLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
      </label>
    </div>
    {parsed.table && <>
      <p>{file?.name} · {parsed.table.rows.length} {tr('строк')}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {columns.map(({ key, title }) => <label key={key}>{tr(title)}
          <select value={effectiveMap[key] ?? ''} onChange={(event) => { setMap({ ...effectiveMap, [key]: event.target.value || undefined }); setApproved([]) }}
            className="block w-full border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
            <option value="">—</option>
            {parsed.table!.headers.map((header, index) => <option key={`${header}:${index}`} value={header}>{header}</option>)}
          </select>
        </label>)}
      </div>
    </>}
    {(parsed.error || preview?.error || feedback) && <p role="alert" className="border border-red-500 p-2 text-red-700 dark:text-red-400">{parsed.error || preview?.error || feedback}</p>}
    {value && <>
      <p role="status">{tr('Совпало')}: {value.counts.matched} · {tr('Не найдено')}: {value.counts.unmatched} · {tr('Конфликт')}: {value.counts.conflict}</p>
      <div className="max-h-64 overflow-auto border border-neutral-300 dark:border-neutral-700">
        <table className="w-full min-w-[540px] text-left text-xs"><thead><tr className="border-b border-neutral-300">
          <th className="p-1">#</th><th className="p-1">{tr('Исходная строка')}</th><th className="p-1">{tr('Результат')}</th><th className="p-1">{tr('Подтверждение')}</th>
        </tr></thead><tbody>{value.rows.slice(0, 100).map((row) => <tr key={row.rowNumber} className="border-b border-neutral-200 dark:border-neutral-800">
          <td className="p-1">{row.rowNumber}</td><td className="p-1">{row.source.join(' · ')}</td>
          <td className="p-1">{row.reason ?? (row.match ? `${row.match.kind}: ${row.match.targetId} · ${row.match.method} · ${row.priceTiyn} тиын` : row.status)}</td>
          <td className="p-1">{row.match?.method === 'similar' && <label><input type="checkbox" checked={approved.includes(row.rowNumber)}
            onChange={(event) => setApproved(event.target.checked ? [...approved, row.rowNumber] : approved.filter((n) => n !== row.rowNumber))} /> {tr('Подтвердить похожий код')}</label>}</td>
        </tr>)}</tbody></table>
      </div>
      {value.rows.length > 100 && <p>{tr('Показаны первые 100 строк; все строки будут проверены при применении.')}</p>}
      <button type="button" disabled={!canApplyPricePreview(value.counts)}
        className="border border-neutral-500 px-3 py-1.5 disabled:opacity-40"
        onClick={() => {
          try {
            const next = applyPriceImport(shop, value, targetId, approved)
            setShop(validatedShopEdit(shop, next))
            setFeedback(`${tr('Прайс применён')}: ${value.counts.matched}`)
          } catch (error) { setFeedback(error instanceof Error ? error.message : String(error)) }
        }}>{tr('Применить прайс')}</button>
    </>}
  </section>
}
