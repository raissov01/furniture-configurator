import { describe, expect, it } from 'vitest'
import { dimensionRangeHint } from '../lib/dimensionHint'

describe('dimension guidance', () => {
  it('separates a template recommendation from the enforced input bound', () => {
    expect(dimensionRangeHint({ min: 1200, max: 2700 }, null, null)).toEqual({
      recommended: '1200–2700', shop: null, allowed: '100–4000',
    })
  })
  it('shows shop limits as guidance without changing the enforced bound', () => {
    expect(dimensionRangeHint({ min: 1200, max: 2700 }, 1500, null)).toEqual({
      recommended: '1200–2700', shop: '1500–', allowed: '100–4000',
    })
  })
})
