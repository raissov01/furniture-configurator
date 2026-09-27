import type { ShopProfile } from '@/src/core/shop'
import type { EdgeBand, Material } from '@/src/core/types'

/** A Basis name is catalogue data; its generic reference price is not a shop quote. */
export function addBasisCatalogItem(shop: ShopProfile, item: Material | EdgeBand): ShopProfile {
  if ('sheetWidth' in item) {
    if (shop.materials.some((material) => material.id === item.id)) return shop
    return { ...shop, materials: [...shop.materials, { ...item, pricePerSheet: 0 }] }
  }
  if (shop.edgeBands.some((band) => band.id === item.id)) return shop
  return { ...shop, edgeBands: [...shop.edgeBands, { ...item, pricePerMeter: 0 }] }
}
