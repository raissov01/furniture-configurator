import { describe, expect, it } from 'vitest'
import { parseShelfHeights, shelfCountChange, shelfHeightsChange } from '../lib/shelfDraft'

describe('shelf height entry', () => {
  it('accepts only whole millimetres and synchronizes the displayed count', () => {
    expect(parseShelfHeights('320, 700', 2000)).toEqual({ heights: [320, 700] })
    expect(shelfHeightsChange('320, 700', 4, 2000)).toEqual({ count: 2, at: [320, 700] })
    expect(shelfHeightsChange('', 4, 2000)).toEqual({ count: 4, at: undefined })
  })

  it.each(['0, -4, 320.5, Ә', '320,', '320, 2001', '320, 2.5', 'abc'])
    ('rejects invalid raw text without manufacturing values: %s', (raw) => {
      expect(parseShelfHeights(raw, 2000)).toHaveProperty('error')
      expect(shelfHeightsChange(raw, 4, 2000)).toBeNull()
    })

  it('resets stale explicit heights when the count is edited', () => {
    expect(shelfCountChange(3, 2, [320, 700])).toEqual({ count: 3, at: undefined })
    expect(shelfCountChange(2, 2, [320, 700])).toEqual({ count: 2, at: [320, 700] })
  })
})
