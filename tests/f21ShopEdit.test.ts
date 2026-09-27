import { describe, expect, it } from 'vitest'
import { defaultShopProfile } from '../src/core/shop'
import { validatedShopEdit } from '../lib/validatedShopEdit'

describe('F21 цех профилін сақтар алдындағы тексеру', () => {
  it('теріс және бөлшек тиынды қабылдамайды', () => {
    const shop = defaultShopProfile()
    const band = shop.edgeBands[0]!
    for (const pricePerMeter of [-500, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => validatedShopEdit(shop, { edgeBands: shop.edgeBands.map((item) =>
        item.id === band.id ? { ...item, pricePerMeter } : item) })).toThrow()
    }
  })
  it('дұрыс бағаны бүтін тиынмен сақтайды', () => {
    const shop = defaultShopProfile()
    const next = validatedShopEdit(shop, { edgeBands: [{ ...shop.edgeBands[0]!, pricePerMeter: 125 }, ...shop.edgeBands.slice(1)] })
    expect(next.edgeBands[0]?.pricePerMeter).toBe(125)
  })
})
