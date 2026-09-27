import { describe, expect, it } from 'vitest'
import { defaultPriceColumnMap, canApplyPricePreview } from '../lib/priceImportUi'

describe('F21 прайс импорт интерфейсі', () => {
  it('бағандарды атауымен сәйкестендіреді, қайталамайды', () => {
    expect(defaultPriceColumnMap(['Артикул', 'Баға', 'Бірлік'])).toEqual({ code: 'Артикул', price: 'Баға', unit: 'Бірлік' })
    expect(defaultPriceColumnMap(['Баға', 'Цена', 'Ед. изм.'])).toEqual({ price: 'Баға', unit: 'Ед. изм.' })
  })
  it('қайшылықты және бос preview қолданылмайды', () => {
    expect(canApplyPricePreview({ matched: 0, unmatched: 1, conflict: 0 })).toBe(false)
    expect(canApplyPricePreview({ matched: 1, unmatched: 0, conflict: 1 })).toBe(false)
    expect(canApplyPricePreview({ matched: 1, unmatched: 1, conflict: 0 })).toBe(true)
  })
})
