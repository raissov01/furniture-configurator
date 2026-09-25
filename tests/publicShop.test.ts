import { describe, expect, it } from 'vitest'
import { defaultShopProfile, parseShopProfile } from '../src/core/shop'
import { toProductionShopProfile } from '../src/core/publicShop'

describe('цехтың өндірістік профилі', () => {
  it('присадка баптауын сақтап, барлық баға көзін өшіреді', () => {
    const original = defaultShopProfile()
    const shop = { ...original,
      settings: { ...original.settings, shelfPinDatum: 64 },
      materials: original.materials.map((item, index) => ({ ...item, pricePerSheet: index === 0 ? 123456 : 0 })),
      hardware: original.hardware.map((item, index) => ({ ...item, pricePerUnit: index === 0 ? 98765 : 0 })),
      coefficient: 2.7, markupPercent: 12,
    }
    const publicShop = toProductionShopProfile(shop)
    expect(parseShopProfile(publicShop).settings.shelfPinDatum).toBe(64)
    expect(publicShop.materials.every((item) => item.pricePerSheet === 0)).toBe(true)
    expect(publicShop.edgeBands.every((item) => item.pricePerMeter === 0)).toBe(true)
    expect(publicShop.hardware.every((item) => item.pricePerUnit === 0)).toBe(true)
    expect(publicShop.priceLists.every((list) => Object.keys(list.materialPrices).length === 0)).toBe(true)
    expect(publicShop.coefficient).toBe(1)
    expect(publicShop.markupPercent).toBe(0)
  })
})
