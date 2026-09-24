/**
 * Цехтың бірнеше прайсы. Мұнда тек ақша сақталады; материалдың өзі мен
 * өндірістік ережелер ShopProfile-дің ортақ каталогында қалады.
 */
import { ConfigValidationError } from './errors'
import type { ShopProfile } from './shop'

export type PriceValues = {
  materialPrices: Record<string, { pricePerSheet: number; slabPricePerMeter?: number }>
  edgeBandPrices: Record<string, number>
  hardwarePrices: Record<string, number>
  serviceRates: {
    cutting: number
    drilling: number
    edging: number
    packing: number
    assembly: number
  }
  installationRatePerMetreWidth: number
  coefficient: number
  markupPercent: number
}

export type PriceList = PriceValues & { id: string; name: string }

type PriceSource = Pick<ShopProfile,
  'materials' | 'edgeBands' | 'hardware' | 'services' | 'installation' | 'coefficient' | 'markupPercent'>

/** Қазіргі бағаны жоғалтпай дәл жазу; жаңа тізімді көшіргенде де осы дерек алынады. */
export function capturePriceValues(shop: PriceSource): PriceValues {
  const materialPrices: PriceValues['materialPrices'] = Object.fromEntries(
    shop.materials.map((material) => [material.id, material.slab
      ? { pricePerSheet: material.pricePerSheet, slabPricePerMeter: material.slab.pricePerMeter }
      : { pricePerSheet: material.pricePerSheet }]),
  )
  const edgeBandPrices: PriceValues['edgeBandPrices'] = Object.fromEntries(
    shop.edgeBands.map((band) => [band.id, band.pricePerMeter]),
  )
  const hardwarePrices: PriceValues['hardwarePrices'] = Object.fromEntries(
    shop.hardware.map((item) => [item.id, item.pricePerUnit]),
  )
  return {
    materialPrices, edgeBandPrices, hardwarePrices,
    serviceRates: {
      cutting: shop.services.cutting.rate,
      drilling: shop.services.drilling.rate,
      edging: shop.services.edging.rate,
      packing: shop.services.packing.rate,
      assembly: shop.services.assembly.rate,
    },
    installationRatePerMetreWidth: shop.installation.ratePerMetreWidth,
    coefficient: shop.coefficient,
    markupPercent: shop.markupPercent,
  }
}

function activeList(shop: ShopProfile): PriceList {
  const list = shop.priceLists.find((priceList) => priceList.id === shop.activePriceListId)
  if (!list) {
    throw new ConfigValidationError('activePriceListId',
      `прайс табылмады: "${shop.activePriceListId}"`, shop.priceLists.map((p) => p.id).join(' | '))
  }
  return list
}

/** UI баға өрістерін өзгерткен сайын белсенді прайс snapshot-ы бірге жаңарады. */
export function syncActivePriceList(shop: ShopProfile): ShopProfile {
  activeList(shop)
  const values = capturePriceValues(shop)
  return {
    ...shop,
    priceLists: shop.priceLists.map((list) =>
      list.id === shop.activePriceListId ? { ...list, ...values } : list),
  }
}

/**
 * Жаңа каталог ID-і ескі прайста жоқ болса, оның бағасы 0 тиын.
 * Бағаны өзге прайстан алсақ, клиентке ойдан шығарылған баға кетер еді.
 * Материал/кромка/фурнитура сипаттамасы мен қызмет basis-і өзгермейді.
 */
function applyPriceValues(shop: ShopProfile, values: PriceValues): ShopProfile {
  const materialPrice = (id: string) =>
    Object.hasOwn(values.materialPrices, id) ? values.materialPrices[id] : undefined
  const priceOrZero = (prices: Record<string, number>, id: string) =>
    Object.hasOwn(prices, id) ? prices[id]! : 0
  return {
    ...shop,
    materials: shop.materials.map((material) => ({
      ...material,
      pricePerSheet: materialPrice(material.id)?.pricePerSheet ?? 0,
      ...(material.slab ? {
        slab: { ...material.slab, pricePerMeter: materialPrice(material.id)?.slabPricePerMeter ?? 0 },
      } : {}),
    })),
    edgeBands: shop.edgeBands.map((band) => ({
      ...band, pricePerMeter: priceOrZero(values.edgeBandPrices, band.id),
    })),
    hardware: shop.hardware.map((item) => ({
      ...item, pricePerUnit: priceOrZero(values.hardwarePrices, item.id),
    })),
    services: {
      cutting: { ...shop.services.cutting, rate: values.serviceRates.cutting },
      drilling: { ...shop.services.drilling, rate: values.serviceRates.drilling },
      edging: { ...shop.services.edging, rate: values.serviceRates.edging },
      packing: { ...shop.services.packing, rate: values.serviceRates.packing },
      assembly: { ...shop.services.assembly, rate: values.serviceRates.assembly },
    },
    installation: { ...shop.installation, ratePerMetreWidth: values.installationRatePerMetreWidth },
    coefficient: values.coefficient,
    markupPercent: values.markupPercent,
  }
}

function validName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ConfigValidationError('priceList.name', 'атауы бос болмауы керек')
  return trimmed
}

/** `blank` — нөл бағалы жаңа прайс; `copy` — белсенді нақты бағалардың көшірмесі. */
export function createPriceList(shop: ShopProfile, name: string, mode: 'blank' | 'copy'): ShopProfile {
  const saved = syncActivePriceList(shop)
  const usedIds = new Set(saved.priceLists.map((list) => list.id))
  let id = 'price-list'
  let suffix = 2
  while (usedIds.has(id)) {
    id = `price-list-${suffix}`
    suffix += 1
  }
  const values: PriceValues = mode === 'copy' ? capturePriceValues(shop) : {
    materialPrices: {}, edgeBandPrices: {}, hardwarePrices: {},
    serviceRates: { cutting: 0, drilling: 0, edging: 0, packing: 0, assembly: 0 },
    installationRatePerMetreWidth: 0, coefficient: 1, markupPercent: 0,
  }
  const list: PriceList = { id, name: validName(name), ...values }
  return applyPriceValues({
    ...saved, priceLists: [...saved.priceLists, list], activePriceListId: id,
  }, values)
}

/** Ағымдағы бағаларды бекітіп, сұралған прайстың ақшасын ғана белсенді ету. */
export function switchPriceList(shop: ShopProfile, id: string): ShopProfile {
  const saved = syncActivePriceList(shop)
  const target = saved.priceLists.find((list) => list.id === id)
  if (!target) {
    throw new ConfigValidationError('priceList.id', `прайс табылмады: "${id}"`,
      saved.priceLists.map((list) => list.id).join(' | '))
  }
  return applyPriceValues({ ...saved, activePriceListId: id }, target)
}

export function renamePriceList(shop: ShopProfile, id: string, name: string): ShopProfile {
  const saved = syncActivePriceList(shop)
  if (!saved.priceLists.some((list) => list.id === id)) {
    throw new ConfigValidationError('priceList.id', `прайс табылмады: "${id}"`)
  }
  const trimmed = validName(name)
  return {
    ...saved,
    priceLists: saved.priceLists.map((list) => list.id === id ? { ...list, name: trimmed } : list),
  }
}

export function deletePriceList(shop: ShopProfile, id: string): ShopProfile {
  const saved = syncActivePriceList(shop)
  if (saved.priceLists.length <= 1) {
    throw new ConfigValidationError('priceLists', 'соңғы прайсты өшіруге болмайды')
  }
  if (!saved.priceLists.some((list) => list.id === id)) {
    throw new ConfigValidationError('priceList.id', `прайс табылмады: "${id}"`)
  }
  const remaining = saved.priceLists.filter((list) => list.id !== id)
  if (id !== saved.activePriceListId) return { ...saved, priceLists: remaining }
  const next = remaining[0]!
  return applyPriceValues({ ...saved, priceLists: remaining, activePriceListId: next.id }, next)
}
