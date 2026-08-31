'use client'

/**
 * Деталировка. ГОТОВЫЙ (клиент) мен РЕЗ (цех) бағандары КӨЗБЕН бөлек тұруы
 * керек — цехтағы адам клиенттің готовый өлшемін кесіп алмауы үшін.
 */

import { t as tr } from '@/lib/i18n'
import { useMemo } from 'react'
import { CUT_LIST_COLUMNS, formatCutList } from '@/src/core/index'
import type { Catalog, CutListRow, Panel } from '@/src/core/index'
import { cn } from '@/lib/cn'

const GROUP_STYLE: Record<string, string> = {
  'ГОТОВЫЙ · клиент': 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  'РЕЗ · цех': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'КРОМКА · цех': 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

export function CutListTable({ panels, catalog }: { panels: Panel[]; catalog: Catalog }) {
  const rows: CutListRow[] = useMemo(() => formatCutList(panels, catalog), [panels, catalog])
  const pieces = rows.reduce((s, r) => s + r.qty, 0)

  const groups: { label: string; span: number }[] = []
  for (const col of CUT_LIST_COLUMNS) {
    const last = groups[groups.length - 1]
    if (last && last.label === col.group && col.group !== '') last.span += 1
    else groups.push({ label: col.group, span: 1 })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{tr('Деталировка')}</h2>
        <span className="text-[11px] tabular-nums text-neutral-500">
          Позиций: {rows.length} · Деталей: {pieces}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr>
              {groups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className={cn(
                    'border-b border-neutral-200 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide dark:border-neutral-800',
                    GROUP_STYLE[g.label] ?? 'bg-white dark:bg-neutral-900',
                  )}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className="bg-white dark:bg-neutral-900">
              {CUT_LIST_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap border-b border-neutral-200 px-2 py-1 font-medium text-neutral-500 dark:border-neutral-800',
                    c.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-neutral-50/70 dark:odd:bg-neutral-900/40">
                {CUT_LIST_COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'whitespace-nowrap px-2 py-1 text-neutral-800 dark:text-neutral-200',
                      c.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                      c.audience === 'client' && 'text-sky-800 dark:text-sky-300',
                      c.audience === 'shop' && c.group === 'РЕЗ · цех' && 'font-semibold text-amber-800 dark:text-amber-300',
                    )}
                  >
                    {String(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
