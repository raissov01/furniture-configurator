import { describe, expect, it } from 'vitest'
import { defaultShopProfile } from '../src/core/index'
import { parseDrillingSettingDraft, shelfPinOffsetMinimum } from '../lib/f17ShopDraft'

describe('F17 shop drilling draft', () => {
  const shop = defaultShopProfile()
  const min = shelfPinOffsetMinimum(shop)

  it('uses the shelf pin radius plus subtractable shop edge band', () => {
    expect(min).toBeGreaterThanOrEqual(5)
    expect(parseDrillingSettingDraft('shelfPinFrontOffset', String(min - 1), shop).error)
      .toContain(`${min}..4000`)
    expect(parseDrillingSettingDraft('shelfPinFrontOffset', String(min), shop).value).toBe(min)
  })

  it('keeps blank, text and fractional draft out of persisted state', () => {
    for (const text of ['', 'қате', '2.5', '0']) {
      const result = parseDrillingSettingDraft('shelfPinFrontOffset', text, shop)
      expect(result.value).toBeUndefined()
      expect(result.error).toContain('shelfPinFrontOffset')
    }
  })
})
