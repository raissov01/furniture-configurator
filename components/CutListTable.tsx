'use client'

/**
 * Деталировка. ГОТОВЫЙ (клиент) мен РЕЗ (цех) бағандары КӨЗБЕН бөлек тұруы
 * керек — цехтағы адам клиенттің готовый өлшемін кесіп алмауы үшін.
 */

import { getLang, t as tr } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { CUT_LIST_COLUMNS, formatCutList, panelFitWarnings } from '@/src/core/index'
import type { Catalog, CutListRow, Panel } from '@/src/core/index'
import { cn } from '@/lib/cn'
import { nextCutListSort, sortCutListRows } from '@/lib/cutListSort'
import type { CutListSort } from '@/lib/cutListSort'

const GROUP_STYLE: Record<string, string> = {
  'ГОТОВЫЙ · клиент': 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  'РЕЗ · цех': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'КРОМКА · цех': 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

/**
 * `collapsed` — жиылған күйде тек тақырып пен «Позиций · Деталей» көрінеді.
 * Кесте DOM-да ҚАЛАДЫ (класспен жасырылады): e2e мен беттен іздеу оны
 * жабық күйде де табады (`Collapsible` гочасын қара).
 */
export function CutListTable({
  panels, catalog, collapsed = false, onToggle,
}: { panels: Panel[]; catalog: Catalog; collapsed?: boolean; onToggle?: () => void }) {
  const rows: CutListRow[] = useMemo(() => formatCutList(panels, catalog), [panels, catalog])
  const [sort, setSort] = useState<CutListSort | null>(null)
  const sortedRows = useMemo(() => sortCutListRows(rows, sort, getLang()), [rows, sort])
  const pieces = rows.reduce((s, r) => s + r.qty, 0)
  /*
   * Параққа сыймайтын деталь ОСЫ ЖЕРДЕ айтылады. Раскрой да айтады, бірақ ол
   * — басқа бет: габаритті терген адам оны кеш көреді де, бүкіл жобаны қайта
   * теруге мәжбүр болады.
   */
  const fitWarnings = useMemo(() => panelFitWarnings(panels, catalog), [panels, catalog])

  const groups: { label: string; span: number }[] = []
  for (const col of CUT_LIST_COLUMNS) {
    const last = groups[groups.length - 1]
    if (last && last.label === col.group && col.group !== '') last.span += 1
    else groups.push({ label: col.group, span: 1 })
  }

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-baseline justify-between gap-2 border-b border-neutral-200 px-3 py-2 text-left disabled:cursor-default dark:border-neutral-800"
      >
        <span className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {onToggle ? (
            <span className={cn('text-[10px] transition-transform', !collapsed && 'rotate-90')}>▶</span>
          ) : null}
          {tr('Деталировка')}
        </span>
        <span className="text-[11px] tabular-nums text-neutral-500">
          {collapsed && fitWarnings.length > 0 ? (
            <span className="mr-2 text-amber-700 dark:text-amber-400">
              {tr('Не помещается на лист')}: {fitWarnings.length}
            </span>
          ) : null}
          Позиций: {rows.length} · Деталей: {pieces}
        </span>
      </button>
      {fitWarnings.length > 0 && !collapsed ? (
        <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="font-semibold">{tr('Не помещается на лист')}</div>
          <ul className="mt-1 list-disc pl-4">
            {fitWarnings.map((w) => (
              <li key={w.panelId}>
                {w.label}: {w.message}
              </li>
            ))}
          </ul>
          <div className="mt-1 opacity-80">
            {tr('Это не ошибка: деталь можно разделить и состыковать при сборке.')}
          </div>
        </div>
      ) : null}
      <div className={cn('min-h-0 flex-1 overflow-auto', collapsed && 'hidden')}>
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
                  scope="col"
                  aria-sort={sort?.key === c.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : undefined}
                  className={cn(
                    'whitespace-nowrap border-b border-neutral-200 p-0 font-medium text-neutral-500 dark:border-neutral-800',
                    c.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  <button type="button"
                    aria-label={`${tr('Сортировать')}: ${c.group ? `${tr(c.group)} · ` : ''}${tr(c.header)}`}
                    onClick={() => setSort((current) => nextCutListSort(current, c.key))}
                    className={cn('flex w-full items-center gap-1 px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 dark:hover:bg-neutral-800', c.align === 'right' ? 'justify-end' : 'justify-start')}
                  >
                    <span>{tr(c.header)}</span>
                    {sort?.key === c.key ? <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
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
