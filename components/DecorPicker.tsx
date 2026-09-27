'use client'

/**
 * Декор таңдағыш: плитаны атымен емес, ТҮСІМЕН таңдайды.
 *
 * Қалыңдық пен декор — екі бөлек шешім, сондықтан екі бөлек қатар: цех
 * «18 мм-ге ауысайын» дегенде декорын қайта іздеп отырмауы керек.
 */

import { useMemo, useState } from 'react'
import type { Material } from '@/src/core/index'
import { cn } from '@/lib/cn'
import { t as tr } from '@/lib/i18n'
import { ownCatalogBuild } from '@/src/core/data/catalog'
import { filterOwnMaterials, ownMaterialOptions } from '@/lib/ownCatalogUi'
import type { OwnMaterialMeta } from '@/src/core/data/catalog/schema'

function swatchStyle(m: Material): React.CSSProperties {
  const color = m.decor?.color ?? '#b8b4ac'
  return { background: color }
}

export function DecorPicker({
  materials, value, onChange, showThickness = true,
}: {
  materials: Material[]
  value: string
  onChange: (materialId: string) => void
  showThickness?: boolean
}) {
  const current = materials.find((m) => m.id === value)
  const [manufacturer, setManufacturer] = useState('')
  const [collection, setCollection] = useState('')
  const [decorCode, setDecorCode] = useState('')
  const meta: Record<string, OwnMaterialMeta> = useMemo(() => materials.some((material) => material.id.startsWith('own-'))
    ? ownCatalogBuild().materialMeta : {}, [materials])
  const ownMaterials = useMemo(() => materials.filter((material) => Boolean(meta[material.id])), [materials, meta])
  const options = useMemo(() => ownMaterialOptions(ownMaterials, meta), [ownMaterials, meta])
  const collections = useMemo(() => [...new Set(ownMaterials.map((material) => meta[material.id])
    .filter((entry) => entry && (!manufacturer || entry.manufacturer === manufacturer) && entry.collection)
    .map((entry) => entry!.collection!))].sort((a, b) => a.localeCompare(b)), [ownMaterials, meta, manufacturer])
  const filtering = Boolean(manufacturer || collection || decorCode)
  const filtered = (pool: Material[]) => filtering
    ? filterOwnMaterials(pool, meta, { manufacturer, collection, decorCode }) : pool

  const filteredMaterials = filtered(materials)
  const thicknesses = [...new Set(filteredMaterials.map((m) => m.thickness))].sort((a, b) => a - b)
  const thickness = current && thicknesses.includes(current.thickness) ? current.thickness : thicknesses[0]
  const sameThickness = filteredMaterials.filter((m) => m.thickness === thickness)

  /** Қалыңдықты ауыстырғанда декорды САҚТАП қалуға тырысамыз. */
  const switchThickness = (next: number) => {
    const pool = filteredMaterials.filter((m) => m.thickness === next)
    const sameDecor = pool.find((m) => m.decor?.color === current?.decor?.color)
    const chosen = sameDecor ?? pool[0]
    if (chosen) onChange(chosen.id)
  }

  return (
    <div className="space-y-2">
      {ownMaterials.length > 0 && <div className="grid grid-cols-3 gap-1 text-[11px]">
        <select aria-label={tr('Производитель')} value={manufacturer} onChange={(event) => { setManufacturer(event.target.value); setCollection('') }}
          className="min-w-0 border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Все производители')}</option>
          {options.manufacturers.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label={tr('Коллекция')} value={collection} onChange={(event) => setCollection(event.target.value)}
          className="min-w-0 border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Все коллекции')}</option>
          {collections.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <input aria-label={tr('Код декора')} placeholder={tr('Код декора')} value={decorCode} onChange={(event) => setDecorCode(event.target.value)}
          className="min-w-0 border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900" />
      </div>}
      {showThickness && thicknesses.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {thicknesses.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchThickness(t)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] tabular-nums transition',
                t === thickness
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
              )}
            >
              {t} мм
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {sameThickness.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.name}
            aria-label={m.name}
            aria-pressed={m.id === value}
            data-decor-swatch
            onClick={() => onChange(m.id)}
            className={cn(
              'h-8 w-8 rounded-md border transition',
              m.id === value
                ? 'border-neutral-900 ring-2 ring-neutral-900 ring-offset-1 dark:border-neutral-100 dark:ring-neutral-100 dark:ring-offset-neutral-900'
                : 'border-neutral-300 hover:border-neutral-500 dark:border-neutral-700',
            )}
            style={swatchStyle(m)}
          />
        ))}
      </div>

      <p className="text-[11px] leading-snug text-neutral-500">{filtering && filteredMaterials.length === 0
        ? `${tr('Найдено')}: 0` : current?.name ?? tr('Материал не выбран')}</p>
    </div>
  )
}
