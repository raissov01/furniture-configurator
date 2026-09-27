'use client'

import { useMemo, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { filterOwnMaterials, ownMaterialOptions } from '@/lib/ownCatalogUi'
import { ownCatalogBuild } from '@/src/core/data/catalog'
import type { Material } from '@/src/core/types'

const PAGE_SIZE = 40

export function OwnMaterialChooser({ existingIds, onAdd }: { existingIds: string[]; onAdd: (material: Material) => void }) {
  const catalog = useMemo(() => ownCatalogBuild(), [])
  const options = useMemo(() => ownMaterialOptions(catalog.materials, catalog.materialMeta), [catalog])
  const [manufacturer, setManufacturer] = useState('')
  const [collection, setCollection] = useState('')
  const [decorCode, setDecorCode] = useState('')
  const [page, setPage] = useState(0)
  const matching = useMemo(() => filterOwnMaterials(catalog.materials, catalog.materialMeta,
    { manufacturer, collection, decorCode }), [catalog, manufacturer, collection, decorCode])
  const collections = useMemo(() => {
    if (!manufacturer) return options.collections
    return [...new Set(catalog.materials.map((material) => catalog.materialMeta[material.id])
      .filter((entry) => entry?.manufacturer === manufacturer && entry.collection)
      .map((entry) => entry!.collection!))].sort((a, b) => a.localeCompare(b))
  }, [catalog, manufacturer, options.collections])
  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = matching.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const existing = new Set(existingIds)

  return <section className="space-y-2 border border-neutral-300 p-2 text-xs dark:border-neutral-700" aria-label={tr('Открытый каталог материалов')}>
    <h3 className="font-semibold">{tr('Открытый каталог материалов')}</h3>
    <p className="text-neutral-500 dark:text-neutral-400">{tr('Проверяйте наличие и формат у поставщика перед раскроем. Цена не переносится автоматически.')}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="block">{tr('Производитель')}
        <select aria-label={tr('Производитель')} value={manufacturer} onChange={(event) => {
          setManufacturer(event.target.value); setCollection(''); setPage(0)
        }} className="mt-1 w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Все производители')}</option>
          {options.manufacturers.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block">{tr('Коллекция')}
        <select aria-label={tr('Коллекция')} value={collection} onChange={(event) => { setCollection(event.target.value); setPage(0) }}
          className="mt-1 w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Все коллекции')}</option>
          {collections.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block">{tr('Код декора')}
        <input aria-label={tr('Код декора')} value={decorCode} onChange={(event) => { setDecorCode(event.target.value); setPage(0) }}
          className="mt-1 w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900" />
      </label>
    </div>
    <p>{tr('Найдено')}: {matching.length}</p>
    <div className="max-h-64 space-y-1 overflow-auto">
      {visible.map((material) => {
        const meta = catalog.materialMeta[material.id]!
        return <div key={material.id} className="flex items-start justify-between gap-2 border border-neutral-300 p-2 dark:border-neutral-700">
          <div className="min-w-0">
            <p className="font-medium">{meta.manufacturer} {meta.decorCode} · {material.name}</p>
            <p>{material.thickness} {tr('мм')} · {material.sheetHeight} (H) × {material.sheetWidth} (W) {tr('мм')}</p>
            <p className="text-neutral-500 dark:text-neutral-400">{meta.collection ?? tr('Без коллекции')} · {meta.sizeBasis === 'range-wide' ? tr('Формат продуктовой линейки') : tr('Формат декора')}</p>
            <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{tr('Источник')}</a>
          </div>
          <button type="button" disabled={existing.has(material.id)} onClick={() => onAdd(material)}
            className="shrink-0 border border-neutral-500 px-2 py-1 disabled:opacity-40">
            {existing.has(material.id) ? tr('Добавлено') : tr('Добавить в цех')}
          </button>
        </div>
      })}
    </div>
    {totalPages > 1 && <div className="flex items-center justify-between gap-2">
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="border border-neutral-500 px-2 py-1 disabled:opacity-40">{tr('Назад')}</button>
      <span>{currentPage + 1} / {totalPages}</span>
      <button type="button" disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)} className="border border-neutral-500 px-2 py-1 disabled:opacity-40">{tr('Далее')}</button>
    </div>}
  </section>
}
