/** Бір цехтағы бірнеше прайс: тек ақша ауысады, өндіріс геометриясы өзгермейді. */
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  createPriceList, defaultShopProfile, deletePriceList, parseShopProfile,
  renamePriceList, switchPriceList,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'

function pricedShop(): ShopProfile {
  const base = defaultShopProfile('prices-test')
  return {
    ...base,
    materials: [
      { ...base.materials[0]!, pricePerSheet: 2_850_000 },
      {
        ...base.materials[1]!, id: 'slab-test', pricePerSheet: 0,
        slab: { stockLengths: [3050, 4100], pricePerMeter: 990_000 },
      },
    ],
    edgeBands: [{ ...base.edgeBands[0]!, pricePerMeter: 9500 }],
    hardware: [{ ...base.hardware[0]!, pricePerUnit: 18_000 }],
    services: {
      ...base.services,
      cutting: { basis: 'sheet', rate: 200_000 },
      drilling: { basis: 'hole', rate: 5000 },
    },
    installation: { ratePerMetreWidth: 80_000 },
    coefficient: 1.35,
    markupPercent: 17,
  }
}

describe('цех прайс-парақтары', () => {
  it('бүлінген v6 профиль миграцияда raw TypeError емес, өріс жолы бар Zod қатесін береді', () => {
    try {
      parseShopProfile({ schemaVersion: 6, id: 'invalid' })
      throw new Error('Күтілген ZodError болмады')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const issues = (error as ZodError).issues
      expect(issues.some((issue) => issue.path.join('.') === 'materials')).toBe(true)
      expect(issues.some((issue) => issue.path.join('.') === 'services')).toBe(true)
    }
  })

  it('ескі v6 профиль ағымдағы НАҚТЫ бағалардан бір негізгі прайсқа көшеді', () => {
    const current = pricedShop()
    const legacy = { ...current, schemaVersion: 6 }
    delete (legacy as { priceLists?: unknown }).priceLists
    delete (legacy as { activePriceListId?: unknown }).activePriceListId
    const migrated = parseShopProfile(legacy)
    expect(migrated.schemaVersion).toBe(7)
    expect(migrated.priceLists).toHaveLength(1)
    expect(migrated.activePriceListId).toBe(migrated.priceLists[0]!.id)
    const blank = createPriceList(migrated, 'Бос прайс', 'blank')
    const restored = switchPriceList(blank, migrated.activePriceListId)
    expect(restored.materials[0]!.pricePerSheet).toBe(2_850_000)
    expect(restored.materials[1]!.slab!.pricePerMeter).toBe(990_000)
    expect(restored.edgeBands[0]!.pricePerMeter).toBe(9500)
    expect(restored.hardware[0]!.pricePerUnit).toBe(18_000)
    expect(restored.services.cutting.rate).toBe(200_000)
    expect(restored.services.drilling.rate).toBe(5000)
    expect(restored.installation.ratePerMetreWidth).toBe(80_000)
    expect(restored.coefficient).toBe(1.35)
    expect(restored.markupPercent).toBe(17)
  })

  it('бос прайс барлық бағаны нөлдейді; сипаттама, өлшем, basis, баптау өзгермейді', () => {
    const shop = pricedShop()
    const blank = createPriceList(shop, 'Жаңа', 'blank')
    expect(blank.materials.map((m) => [m.pricePerSheet, m.slab?.pricePerMeter ?? 0]))
      .toEqual([[0, 0], [0, 0]])
    expect(blank.edgeBands[0]!.pricePerMeter).toBe(0)
    expect(blank.hardware[0]!.pricePerUnit).toBe(0)
    expect(Object.values(blank.services).every((service) => service.rate === 0)).toBe(true)
    expect(blank.coefficient).toBe(1)
    expect(blank.markupPercent).toBe(0)
    expect(blank.installation.ratePerMetreWidth).toBe(0)
    expect(blank.materials.map(({ pricePerSheet, slab, ...physical }) =>
      ({ ...physical, slab: slab && { ...slab, pricePerMeter: 0 } })))
      .toEqual(shop.materials.map(({ pricePerSheet, slab, ...physical }) =>
        ({ ...physical, slab: slab && { ...slab, pricePerMeter: 0 } })))
    expect(Object.fromEntries(Object.entries(blank.services).map(([id, service]) => [id, service.basis])))
      .toEqual(Object.fromEntries(Object.entries(shop.services).map(([id, service]) => [id, service.basis])))
    expect(blank.settings).toEqual(shop.settings)
    expect(blank.cutting).toEqual(shop.cutting)
    expect(blank.limits).toEqual(shop.limits)
  })

  it('көшіру және ауыстыру өзгертілген белсенді бағаларды жоғалтпайды; reload та сақтайды', () => {
    const shop = pricedShop()
    const copied = createPriceList(shop, 'Көтерме', 'copy')
    expect(copied.materials[0]!.pricePerSheet).toBe(2_850_000)
    const edited = {
      ...copied,
      materials: copied.materials.map((m, i) => i === 0
        ? { ...m, pricePerSheet: 2_100_000 }
        : { ...m, slab: { ...m.slab!, pricePerMeter: 770_000 } }),
      edgeBands: copied.edgeBands.map((band) => ({ ...band, pricePerMeter: 8000 })),
      hardware: copied.hardware.map((item) => ({ ...item, pricePerUnit: 12_000 })),
      services: {
        ...copied.services,
        cutting: { ...copied.services.cutting, rate: 150_000 },
        drilling: { ...copied.services.drilling, rate: 3000 },
      },
      installation: { ratePerMetreWidth: 60_000 },
      coefficient: 1.2,
      markupPercent: 20,
    }
    const old = switchPriceList(edited, shop.activePriceListId)
    expect(old.materials[0]!.pricePerSheet).toBe(2_850_000)
    expect(old.materials[1]!.slab!.pricePerMeter).toBe(990_000)
    expect(old.edgeBands[0]!.pricePerMeter).toBe(9500)
    expect(old.hardware[0]!.pricePerUnit).toBe(18_000)
    expect(old.services.cutting.rate).toBe(200_000)
    const wholesale = switchPriceList(old, copied.activePriceListId)
    expect(wholesale.materials[0]!.pricePerSheet).toBe(2_100_000)
    expect(wholesale.materials[1]!.slab!.pricePerMeter).toBe(770_000)
    expect(wholesale.edgeBands[0]!.pricePerMeter).toBe(8000)
    expect(wholesale.hardware[0]!.pricePerUnit).toBe(12_000)
    expect(wholesale.services.cutting.rate).toBe(150_000)
    expect(wholesale.services.drilling.rate).toBe(3000)
    expect(wholesale.installation.ratePerMetreWidth).toBe(60_000)
    expect(wholesale.coefficient).toBe(1.2)
    expect(wholesale.markupPercent).toBe(20)
    expect(parseShopProfile(JSON.parse(JSON.stringify(wholesale)))).toEqual(wholesale)
  })

  it('кейін қосылған каталог ID-і өзге прайста жоқ болса бағасы 0, геометриясы сол күйі', () => {
    const shop = pricedShop()
    const other = createPriceList(shop, 'Басқа', 'copy')
    const newMaterial = { ...shop.materials[0]!, id: 'later', thickness: 18, pricePerSheet: 123_000 }
    const newSlab = { ...shop.materials[1]!, id: 'later-slab', slab: { ...shop.materials[1]!.slab!, pricePerMeter: 88_000 } }
    const newBand = { ...shop.edgeBands[0]!, id: 'later-band', pricePerMeter: 7000 }
    const newHardware = { ...shop.hardware[0]!, id: 'later-hardware', pricePerUnit: 9000 }
    const withNew = {
      ...other,
      materials: [...other.materials, newMaterial, newSlab],
      edgeBands: [...other.edgeBands, newBand],
      hardware: [...other.hardware, newHardware],
    }
    const switched = switchPriceList(withNew, shop.activePriceListId)
    expect(switched.materials.at(-2)).toMatchObject({ id: 'later', thickness: 18, pricePerSheet: 0 })
    expect(switched.materials.at(-1)!.slab).toMatchObject({ stockLengths: [3050, 4100], pricePerMeter: 0 })
    expect(switched.edgeBands.at(-1)).toMatchObject({ id: 'later-band', pricePerMeter: 0 })
    expect(switched.hardware.at(-1)).toMatchObject({ id: 'later-hardware', pricePerUnit: 0 })
    const back = switchPriceList(switched, other.activePriceListId)
    expect(back.materials.at(-2)!.pricePerSheet).toBe(123_000)
    expect(back.materials.at(-1)!.slab!.pricePerMeter).toBe(88_000)
    expect(back.edgeBands.at(-1)!.pricePerMeter).toBe(7000)
    expect(back.hardware.at(-1)!.pricePerUnit).toBe(9000)
  })

  it('атауын өзгерту, өшіру және соңғы прайсты қорғау', () => {
    const shop = pricedShop()
    expect(() => deletePriceList(shop, shop.activePriceListId)).toThrow(/соңғы/)
    const second = createPriceList(shop, 'Баға 2', 'copy')
    const renamed = renamePriceList(second, second.activePriceListId, 'Клиент А')
    expect(renamed.priceLists[1]!.name).toBe('Клиент А')
    expect(() => renamePriceList(renamed, renamed.activePriceListId, '  ')).toThrow()
    const deleted = deletePriceList(renamed, renamed.activePriceListId)
    expect(deleted.priceLists).toHaveLength(1)
    expect(deleted.activePriceListId).toBe(shop.activePriceListId)
    expect(deleted.materials[0]!.pricePerSheet).toBe(2_850_000)
  })

  it('бүлінген прайс пен бөлшек тиын сақталған профильден өтпейді', () => {
    const shop = defaultShopProfile()
    expect(() => parseShopProfile({ ...shop, activePriceListId: 'missing' })).toThrow()
    expect(() => parseShopProfile({ ...shop, priceLists: [shop.priceLists[0], shop.priceLists[0]] })).toThrow()
    const invalid = structuredClone(shop)
    invalid.priceLists[0]!.serviceRates.cutting = 1.5
    expect(() => parseShopProfile(invalid)).toThrow()
  })
})
