import { ShopProfileSchema } from '@/src/core/shop'
import { syncActivePriceList } from '@/src/core/priceLists'
import type { ShopProfile } from '@/src/core/shop'

/** Бір edit тұтас профильді бұзбағанын күй мен localStorage өзгермей тұрып тексеру. */
export function validatedShopEdit(shop: ShopProfile, patch: Partial<ShopProfile>): ShopProfile {
  return ShopProfileSchema.parse(syncActivePriceList({ ...shop, ...patch })) as ShopProfile
}
