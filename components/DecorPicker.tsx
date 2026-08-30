'use client'

/**
 * Декор таңдағыш: плитаны атымен емес, ТҮСІМЕН таңдайды.
 *
 * Қалыңдық пен декор — екі бөлек шешім, сондықтан екі бөлек қатар: цех
 * «18 мм-ге ауысайын» дегенде декорын қайта іздеп отырмауы керек.
 */

import { useMemo } from 'react'
import type { Material } from '@/src/core/index'
import { cn } from '@/lib/cn'

/** Ағаш декорды біртүстіден ажырату: жеңіл жолақ — текстураның белгісі. */
function swatchStyle(m: Material): React.CSSProperties {
  const color = m.decor?.color ?? '#b8b4ac'
  if (m.decor?.kind !== 'wood') return { background: color }
  return {
    background: `repeating-linear-gradient(96deg, ${color} 0 5px, color-mix(in srgb, ${color} 84%, #000) 5px 7px)`,
  }
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

  const thicknesses = useMemo(
    () => [...new Set(materials.map((m) => m.thickness))].sort((a, b) => a - b),
    [materials],
  )
  const thickness = current?.thickness ?? thicknesses[0]!
  const sameThickness = materials.filter((m) => m.thickness === thickness)

  /** Қалыңдықты ауыстырғанда декорды САҚТАП қалуға тырысамыз. */
  const switchThickness = (next: number) => {
    const pool = materials.filter((m) => m.thickness === next)
    const sameDecor = pool.find((m) => m.decor?.color === current?.decor?.color)
    const chosen = sameDecor ?? pool[0]
    if (chosen) onChange(chosen.id)
  }

  return (
    <div className="space-y-2">
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

      <p className="text-[11px] leading-snug text-neutral-500">{current?.name ?? 'Материал не выбран'}</p>
    </div>
  )
}
