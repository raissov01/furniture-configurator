import { describe, expect, it } from 'vitest'
import { addBasisCatalogItem } from '../components/panels/basisLibrarySelect'
import { BASIS_EDGE_BANDS, BASIS_MATERIALS } from '../src/core/data/basisCatalog'
import { defaultShopProfile, parseShopProfile } from '../src/core/shop'

describe('Базис материалы мен кромкасын цехқа таңдау', () => {
  it('анықтамалық бағаны цех бағасына көшірмей материалды дәл бір рет қосады', () => {
    const shop = defaultShopProfile()
    const material = BASIS_MATERIALS.find((item) => item.pricePerSheet > 0 && !shop.materials.some((existing) => existing.id === item.id))!
    const selected = addBasisCatalogItem(shop, material)
    expect(selected.materials.find((item) => item.id === material.id)).toEqual({ ...material, pricePerSheet: 0 })
    expect(addBasisCatalogItem(selected, material)).toBe(selected)
    expect(() => parseShopProfile(selected)).not.toThrow()
  })

  it('ені сақталған кромканы дәл бір рет қосады', () => {
    const shop = defaultShopProfile()
    const band = BASIS_EDGE_BANDS.find((item) => !shop.edgeBands.some((existing) => existing.id === item.id) && item.widthMm !== undefined)!
    const selected = addBasisCatalogItem(shop, band)
    expect(selected.edgeBands.find((item) => item.id === band.id)).toEqual(band)
    expect(addBasisCatalogItem(selected, band)).toBe(selected)
    expect(() => parseShopProfile(selected)).not.toThrow()
  })
})
