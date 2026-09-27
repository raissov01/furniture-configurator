import { ShopProfileSchema } from '@/src/core/shop'
import { syncActivePriceList } from '@/src/core/priceLists'
import type { ShopProfile } from '@/src/core/shop'
import { EdgeBandSchema, MaterialSchema } from '@/src/core/schema'
import type { EdgeBand, Material } from '@/src/core/types'

/** Бір edit тұтас профильді бұзбағанын күй мен localStorage өзгермей тұрып тексеру. */
export function validatedShopEdit(shop: ShopProfile, patch: Partial<ShopProfile>): ShopProfile {
  return ShopProfileSchema.parse(syncActivePriceList({ ...shop, ...patch })) as ShopProfile
}

export function validateProjectShopInputs(materials: Material[], edgeBands: EdgeBand[]): true {
  MaterialSchema.array().parse(materials)
  EdgeBandSchema.array().parse(edgeBands)
  return true
}
