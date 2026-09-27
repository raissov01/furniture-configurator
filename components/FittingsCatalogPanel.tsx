'use client'

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { FITTINGS_CATALOG } from '@/src/core/data/fittings'
import type { FittingProduct } from '@/src/core/data/fittings'
import { fittingArticleIssue } from './FittingArticlePicker'

const KIND_NAMES: Record<FittingProduct['kind'], string> = {
  hinge: 'Петля', 'concealed-runner': 'Скрытая направляющая', 'roller-runner': 'Роликовая направляющая',
  'ball-runner': 'Шариковая направляющая', 'box-system': 'Система ящика', lift: 'Подъёмный механизм',
}

export function FittingsCatalogPanel() {
  const [brand, setBrand] = useState('')
  const [kind, setKind] = useState('')
  const [query, setQuery] = useState('')
  const sources = new Map(FITTINGS_CATALOG.sources.map((source) => [source.id, source]))
  const brands = [...new Set(FITTINGS_CATALOG.products.map((product) => product.brand))].sort((a, b) => a.localeCompare(b))
  const products = FITTINGS_CATALOG.products.filter((product) =>
    (!brand || product.brand === brand) && (!kind || product.kind === kind) &&
    (!query || `${product.family} ${product.variant} ${product.articleExamples.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())))

  return <section className="space-y-2 border border-neutral-300 p-2 text-xs dark:border-neutral-700" aria-label={tr('Справочник фурнитуры')}>
    <h3 className="font-semibold">{tr('Справочник фурнитуры')}</h3>
    <p className="text-neutral-500 dark:text-neutral-400">{tr('Размеры взяты из официальных документов. Неполная схема не используется для ЧПУ.')}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <label>{tr('Производитель')}
        <select value={brand} onChange={(event) => setBrand(event.target.value)}
          className="mt-1 block w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Все производители')}</option>
          {brands.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>{tr('Тип фурнитуры')}
        <select value={kind} onChange={(event) => setKind(event.target.value)}
          className="mt-1 block w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Все типы')}</option>
          {(Object.keys(KIND_NAMES) as Array<FittingProduct['kind']>).map((value) =>
            <option key={value} value={value}>{tr(KIND_NAMES[value])}</option>)}
        </select>
      </label>
      <label>{tr('Артикул или серия')}
        <input value={query} onChange={(event) => setQuery(event.target.value)}
          className="mt-1 block w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900" />
      </label>
    </div>
    <p>{tr('Найдено')}: {products.length}</p>
    <div className="max-h-72 space-y-2 overflow-auto">
      {products.map((product) => {
        const missing = product.kind === 'hinge' ? fittingArticleIssue(product) : product.kind === 'lift'
          ? 'lift template' : 'article-length hole offsets'
        return <article key={product.id} className="border border-neutral-300 p-2 dark:border-neutral-700">
          <h4 className="font-medium">{product.brand} · {product.family} · {product.variant}</h4>
          <p>{tr('Артикул производителя')}: {product.articleExamples.join(', ') || '—'}</p>
          {missing ? <p className="text-amber-700 dark:text-amber-300">{tr('Недостаточно данных для присадки')}: {missing}</p>
            : <p>{tr('Схема планки заполнена')}</p>}
          <ul className="mt-1 space-y-0.5 text-neutral-500 dark:text-neutral-400">
            {product.drilling.map((row, index) => <li key={`${row.operation}-${index}`}>
              {row.operation} · Ø{row.diameterMm ?? '—'} {tr('мм')} · {tr('Глубина')}: {typeof row.depthMm === 'number'
                ? row.depthMm : row.depthMm ? `≥${row.depthMm.minimum}` : '—'} {tr('мм')}
              {row.pitchMm !== null ? ` · ${tr('Шаг')}: ${row.pitchMm} ${tr('мм')}` : ''}
            </li>)}
          </ul>
          <div className="mt-1 flex flex-wrap gap-2">
            {product.sourceIds.map((id) => {
              const source = sources.get(id)
              return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                {tr('Официальный чертёж')}: {source.publisher} · {source.documentPage}
              </a> : null
            })}
          </div>
        </article>
      })}
    </div>
  </section>
}
