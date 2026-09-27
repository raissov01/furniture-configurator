import { describe, expect, it } from 'vitest'
import { nextCutListSort, sortCutListRows } from '@/lib/cutListSort'
import type { CutListRow } from '@/src/core/index'

const row = (name: string, qty: number, cutLength: number, edgeL1 = '—'): CutListRow => ({
  name, qty, cutLength, edgeL1, finishedLength: cutLength + 2,
  finishedWidth: 400, cutWidth: 398, thickness: 16, material: 'ЛДСП',
  edgeL2: '—', edgeW1: '—', edgeW2: '—', grain: 'нет', note: '',
})

describe('F15 cut list sorting', () => {
  const rows = [row('Сөре', 2, 100, '2.0'), row('Боковина', 10, 20, '0.4'), row('Арқа', 1, 300)]

  it('keeps the manufacturing order without an active sort and never mutates source rows', () => {
    expect(sortCutListRows(rows, null, 'ru')).toEqual(rows)
    expect(rows.map((item) => item.name)).toEqual(['Сөре', 'Боковина', 'Арқа'])
  })

  it('compares quantities and dimensions as numbers', () => {
    expect(sortCutListRows(rows, { key: 'qty', direction: 'asc' }, 'ru').map((item) => item.qty)).toEqual([1, 2, 10])
    expect(sortCutListRows(rows, { key: 'cutLength', direction: 'desc' }, 'ru').map((item) => item.cutLength)).toEqual([300, 100, 20])
    expect(sortCutListRows(rows, { key: 'edgeL1', direction: 'asc' }, 'ru').map((item) => item.edgeL1)).toEqual(['0.4', '2.0', '—'])
  })

  it('sorts labels by locale and preserves original order for equal values', () => {
    expect(sortCutListRows(rows, { key: 'name', direction: 'asc' }, 'ru').map((item) => item.name)).toEqual(['Арқа', 'Боковина', 'Сөре'])
    const equal = [row('Сөре', 2, 1), row('Боковина', 2, 2)]
    expect(sortCutListRows(equal, { key: 'qty', direction: 'asc' }, 'ru').map((item) => item.name)).toEqual(['Сөре', 'Боковина'])
  })

  it('cycles ascending, descending, then back to manufacturing order', () => {
    const ascending = nextCutListSort(null, 'qty')
    expect(ascending).toEqual({ key: 'qty', direction: 'asc' })
    const descending = nextCutListSort(ascending, 'qty')
    expect(descending).toEqual({ key: 'qty', direction: 'desc' })
    expect(nextCutListSort(descending, 'qty')).toBeNull()
    expect(nextCutListSort(descending, 'name')).toEqual({ key: 'name', direction: 'asc' })
  })
})
