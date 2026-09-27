import { describe, expect, it } from 'vitest'
import { priceSourceRows } from '../lib/priceSourceUi'

describe('F21 смета жолының көздері', () => {
  it('панель мен фурнитура көзін жеке көрсетеді, тиын сомасын сақтайды', () => {
    const rows = priceSourceRows({ id: 'a', name: 'Кромка', qty: 2, unit: 'м', unitPrice: 125, cost: 250,
      sources: [{ panelId: 'panel-1', qty: 1, cost: 125 }, { placementIndex: 0, qty: 1, cost: 125 }] })
    expect(rows).toEqual([
      { id: 'panel-1', qty: 1, cost: 125 },
      { id: 'placement-1', qty: 1, cost: 125 },
    ])
  })
})
