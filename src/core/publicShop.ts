import type { ShopProfile } from './shop'

/** Өндіріс ережелері сақталады, ал барлық коммерциялық мән нөлденеді. */
export function toProductionShopProfile(shop: ShopProfile): ShopProfile {
  return {
    ...shop,
    materials: shop.materials.map((material) => ({ ...material, pricePerSheet: 0,
      slab: material.slab ? { ...material.slab, pricePerMeter: 0 } : undefined })),
    edgeBands: shop.edgeBands.map((band) => ({ ...band, pricePerMeter: 0 })),
    hardware: shop.hardware.map((item) => ({ ...item, pricePerUnit: 0 })),
    priceLists: shop.priceLists.map((list) => ({ ...list,
      materialPrices: {}, edgeBandPrices: {}, hardwarePrices: {},
      serviceRates: { cutting: 0, drilling: 0, edging: 0, packing: 0, assembly: 0 },
      installationRatePerMetreWidth: 0, coefficient: 1, markupPercent: 0 })),
    labour: { perSquareMetre: 0, perHole: 0, perEdgeMetre: 0 },
    services: Object.fromEntries(Object.entries(shop.services).map(([id, service]) => [id, { ...service, rate: 0 }])) as ShopProfile['services'],
    installation: { ratePerMetreWidth: 0 },
    coefficient: 1,
    markupPercent: 0,
  }
}
