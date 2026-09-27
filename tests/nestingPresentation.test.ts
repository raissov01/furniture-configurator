import { describe, expect, it } from 'vitest'
import { partCaption, sheetPageCount } from '../src/core/export/nestingPresentation'

describe('раскрой картасының оқылуы', () => {
  it('бос қорытынды бет шығармайды', () => {
    expect(sheetPageCount(0)).toBe(1)
    expect(sheetPageCount(1)).toBe(1)
    expect(sheetPageCount(2)).toBe(2)
  })

  it('сыятын жазуды кемінде 8 pt қылады, тар бөлшекте нөмір қояды', () => {
    expect(partCaption('Фасад', 1990, 291, 100, 20, 1, (s, pt) => s.length * pt * 0.6))
      .toEqual({ lines: ['Фасад', '1990 × 291'], size: 8 })
    expect(partCaption('Фасад', 1990, 291, 30, 10, 7, (s, pt) => s.length * pt * 0.6))
      .toEqual({ lines: ['7'], size: 8 })
  })
})
