import { describe, expect, it } from 'vitest'
import { labelLayout } from '../src/core/export/labelLayout'

describe('print label layout', () => {
  it('fits 58 × 40 mm labels on A4 without resizing them', () => {
    const layout = labelLayout({ page: 'a4', widthMm: 58, heightMm: 40 })
    expect(layout.columns).toBe(3)
    expect(layout.rows).toBe(6)
    expect(layout.perPage).toBe(18)
    expect(layout.labelWidthPt).toBeCloseTo(58 * 72 / 25.4)
    expect(layout.labelHeightPt).toBeCloseTo(40 * 72 / 25.4)
  })

  it('supports another size and page, and rejects labels that cannot fit', () => {
    expect(labelLayout({ page: 'a5', widthMm: 70, heightMm: 50 }).perPage).toBe(3)
    expect(() => labelLayout({ page: 'a5', widthMm: 150, heightMm: 40 })).toThrow(/page|лист/)
    expect(() => labelLayout({ page: 'a4', widthMm: 30, heightMm: 20 })).toThrow(/minimum|миним/)
  })
})
