import type { ColumnKey } from '@/src/core/cutList'
import type { CutListRow } from '@/src/core/types'

export type CutListSort = { key: ColumnKey; direction: 'asc' | 'desc' }

const NUMERIC_COLUMNS: ReadonlySet<ColumnKey> = new Set([
  'qty', 'finishedLength', 'finishedWidth', 'cutLength', 'cutWidth', 'thickness',
  'edgeL1', 'edgeL2', 'edgeW1', 'edgeW2',
])

/** Үшінші басу цехтың бастапқы позиция ретін қайтарады. */
export function nextCutListSort(current: CutListSort | null, key: ColumnKey): CutListSort | null {
  if (current?.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

/** Тек экрандағы жолдардың ретін өзгертеді; өндірістік позиция мен экспорт өзгермейді. */
export function sortCutListRows(rows: readonly CutListRow[], sort: CutListSort | null, locale: string): CutListRow[] {
  if (!sort) return [...rows]
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const direction = sort.direction === 'asc' ? 1 : -1
  return rows.map((row, index) => ({ row, index })).sort((a, b) => {
    const left = a.row[sort.key]
    const right = b.row[sort.key]
    let result: number
    if (NUMERIC_COLUMNS.has(sort.key)) {
      const leftNumber = typeof left === 'number' ? left : Number(left)
      const rightNumber = typeof right === 'number' ? right : Number(right)
      const leftMissing = !Number.isFinite(leftNumber)
      const rightMissing = !Number.isFinite(rightNumber)
      if (leftMissing || rightMissing) {
        result = leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1
        return result || a.index - b.index
      }
      result = (leftNumber - rightNumber) * direction
    } else {
      result = collator.compare(String(left), String(right)) * direction
    }
    return result || a.index - b.index
  }).map(({ row }) => row)
}
