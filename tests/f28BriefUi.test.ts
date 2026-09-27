import { describe, expect, it } from 'vitest'
import { briefDimension, currentBriefRequest, formatBriefDimensions } from '../lib/f28BriefUi'

describe('F28 brief UI', () => {
  it('allows untouched optional dimension but rejects cleared, fractional and out of range input', () => {
    expect(briefDimension('', false)).toEqual({ value: undefined })
    for (const raw of ['', '0', '-1', '1.5', 'abc', '999999']) {
      expect(briefDimension(raw, true).error).toContain('100..4000')
    }
    expect(briefDimension('600', true)).toEqual({ value: 600 })
  })
  it('rejects an old async response after any draft change', () => {
    expect(currentBriefRequest(4, 4)).toBe(true)
    expect(currentBriefRequest(4, 5)).toBe(false)
  })
  it('labels every dimension in H W D order', () => {
    expect(formatBriefDimensions({ height: 2000, width: 600, depth: 450 }))
      .toBe('2000 (H) × 600 (W) × 450 (D)')
  })
})
