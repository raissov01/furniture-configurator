import { describe, expect, it } from 'vitest'
import { approvalPrice, parseCoefficientInput, parsePercentInput, parseTengeInput } from '../lib/f22ShareUi'
import { nestPanels, priceProject } from '../src/core/index'
import { defaultShopProfile } from '../src/core/shop'
import { generateCabinet } from '../src/core/generateCabinet'
import { referenceProject } from './fixtures'

describe('F22 UI бағасы мен қатесі', () => {
  it('сату бағасы мен жолдық жеңілдіктен КП қорытындысын қайтарады', () => {
    const base = defaultShopProfile()
    const shop = { ...base,
      materials: base.materials.map((material) => ({ ...material, pricePerSheet: 2_850_000 })),
      edgeBands: base.edgeBands.map((band) => ({ ...band, pricePerMeter: 9_000 })),
      hardware: base.hardware.map((item) => ({ ...item, pricePerUnit: 6_000 })),
    }
    const panels = generateCabinet(referenceProject.cabinets[0]!, { materials: shop.materials, edgeBands: shop.edgeBands })
    const overrides = { salePrice: 13_000_050, lineDiscounts: { [`materials:${panels[0]!.materialId}`]: { kind: 'amount' as const, value: 10_000 } } }
    const expected = priceProject(panels, nestPanels(panels, { materials: shop.materials, edgeBands: shop.edgeBands }), shop, [], [], overrides)
    expect(expected.missingPrices).toEqual([])
    expect(approvalPrice(panels, { materials: shop.materials, edgeBands: shop.edgeBands }, shop, [], [], overrides))
      .toEqual({ kind: 'ready', total: expected.total })
  })

  it('бос, мәтін және артық бөлшекті баға жазбайды', () => {
    expect(parseTengeInput('')).toEqual({ ok: false, allowed: '0..90071992547409.91 ₸, екі ондыққа дейін' })
    expect(parseTengeInput('abc').ok).toBe(false)
    expect(parseTengeInput('1.234').ok).toBe(false)
    expect(parseTengeInput('125000.25')).toEqual({ ok: true, minor: 12_500_025 })
    expect(parseCoefficientInput('')).toEqual({ ok: false, allowed: '> 0' })
    expect(parseCoefficientInput('0').ok).toBe(false)
    expect(parseCoefficientInput('1.25')).toEqual({ ok: true, value: 1.25 })
    expect(parsePercentInput('')).toEqual({ ok: false, allowed: '0..100 %' })
    expect(parsePercentInput('101').ok).toBe(false)
  })

})
