/**
 * Нарық бағасы — жаңа цехтың ӘДЕПКІ бағасы (пайдаланушы шешімі, 09-26).
 *
 * Ереже: медиана тек ашық ұсыныстардан, бүтін тиынмен; дерегі жоқ позиция
 * БОС қалады (§10); цех өзгерткен баға «өз бағасы» — нарық жаңарғанда да,
 * профиль қайта оқылғанда да өзгермейді.
 */
import { describe, expect, it } from 'vitest'
import {
  MARKET_DEFAULTS, MARKET_GROUPS, applyMarketDefaults, MARKET_PRICE_DATE, createPriceList, defaultShopProfile,
  hasNoPrices, marketGroup, marketMedianTiyn, parseShopProfile, priceOrigin, priceProject,
  nestPanels, generateCabinet, findTemplate, templateToCabinet, catalogOf, nestingOptionsOf,
  refreshMarketPrices, resetAllToMarket, resetToMarket, starterShopProfile, switchPriceList,
  syncActivePriceList,
} from '../src/core/index'
import { toProductionShopProfile } from '../src/core/publicShop'
import type { MarketGroup, ShopProfile } from '../src/core/index'

const material = (shop: ShopProfile, id: string) => shop.materials.find((m) => m.id === id)!
const band = (shop: ShopProfile, id: string) => shop.edgeBands.find((b) => b.id === id)!
const hardware = (shop: ShopProfile, id: string) => shop.hardware.find((h) => h.id === id)!

/** v8 профиль (нарық белгісі әлі жоқ кездегі сақталған жазба). */
function legacyV8(shop: ShopProfile): unknown {
  const raw = structuredClone(shop) as unknown as Record<string, unknown>
  raw.schemaVersion = 8
  delete raw.marketPrices
  raw.priceLists = (raw.priceLists as Record<string, unknown>[]).map((list) => {
    const copy = { ...list }
    delete copy.marketPrices
    return copy
  })
  return raw
}

describe('нарық медианасы', () => {
  it('медиана бүтін тиын: жұп санда ортаңғы екеуінің дәл ортасы', () => {
    const group: MarketGroup = {
      id: 't', label: 't', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
      offers: [9564, 9805].map((priceKzt) => ({ supplier: 's', city: 'c', url: 'u', name: 'n', priceKzt })),
    }
    expect(marketMedianTiyn(group)).toBe(968_450)
    const odd = { ...group, offers: [3, 1, 2].map((priceKzt) => ({ ...group.offers[0]!, priceKzt })) }
    expect(marketMedianTiyn(odd)).toBe(200)
  })

  it('SUMMARY.md медианалары ұсыныстардан қайта шығады (ЛДСП Egger 16, ХДФ 3, кромка, қызмет)', () => {
    expect(marketMedianTiyn(marketGroup('ldsp-egger-16-2800x2070')!)).toBe(2_687_000)
    expect(marketGroup('ldsp-egger-16-2800x2070')!.offers).toHaveLength(7)
    expect(marketMedianTiyn(marketGroup('hdf-laminated-3-2800x2070')!)).toBe(750_000)
    expect(marketMedianTiyn(marketGroup('mdf-raw-16-2800x2070')!)).toBe(2_095_000)
    expect(marketMedianTiyn(marketGroup('edge-pvc-1-19-retail')!)).toBe(9100)
    expect(marketMedianTiyn(marketGroup('service-cutting-ldsp-sheet')!)).toBe(200_000)
  })

  it('әр ұсыныс бүтін теңге, сілтемесі бар, күні бір', () => {
    for (const group of MARKET_GROUPS) {
      expect(group.offers.length, group.id).toBeGreaterThan(0)
      expect(group.dateSeen).toBe(MARKET_PRICE_DATE)
      for (const offer of group.offers) {
        expect(Number.isInteger(offer.priceKzt), group.id).toBe(true)
        expect(offer.url.startsWith('https://'), group.id).toBe(true)
      }
    }
  })

  it('әр әдепкі сілтеме бар топқа және бар позицияға нұсқайды', () => {
    const shop = defaultShopProfile()
    for (const [key, entry] of Object.entries(MARKET_DEFAULTS)) {
      expect(marketGroup(entry.group), key).toBeDefined()
      const [kind, id] = key.split(':')
      const exists = kind === 'material' ? shop.materials.some((m) => m.id === id)
        : kind === 'edgeBand' ? shop.edgeBands.some((b) => b.id === id)
          : kind === 'hardware' ? shop.hardware.some((h) => h.id === id)
            : kind === 'service' ? id! in shop.services : false
      expect(exists, key).toBe(true)
    }
  })
})

describe('жаңа цех нарық бағасымен толады', () => {
  const shop = starterShopProfile('new')

  it('ЛДСП 16 мм 2800×2070 — Egger медианасы, белгісі бар', () => {
    expect(material(shop, 'ldsp16-w980').pricePerSheet).toBe(2_687_000)
    expect(priceOrigin(shop, 'material:ldsp16-w980')).toBe('market')
    expect(shop.marketPrices['material:ldsp16-w980']).toEqual({
      group: 'ldsp-egger-16-2800x2070', priceTiyn: 2_687_000, dateSeen: '2026-09-24', offers: 7,
    })
  })

  it('ХДФ, МДФ, кромка, фурнитура, қызмет толады', () => {
    expect(material(shop, 'hdf3-white').pricePerSheet).toBe(750_000)
    expect(material(shop, 'mdf16-paint').pricePerSheet).toBe(2_095_000)
    expect(band(shop, 'pvc04-w980').pricePerMeter).toBe(3300)
    expect(band(shop, 'pvc2-h1145').pricePerMeter).toBe(14_100)
    expect(hardware(shop, 'confirmat-7x50').pricePerUnit).toBe(2000)
    expect(hardware(shop, 'hinge-blum-soft').pricePerUnit).toBe(213_600)
    expect(hardware(shop, 'runner-tandem').pricePerUnit).toBe(968_450)
    expect(shop.services.cutting).toEqual({ basis: 'sheet', rate: 200_000 })
    expect(shop.services.drilling).toEqual({ basis: 'hole', rate: 3500 })
    expect(shop.services.edging).toEqual({ basis: 'edgeMetre', rate: 15_000 })
  })

  it('дерегі жоқ позиция БОС қалады — ойдан баға жоқ', () => {
    expect(material(shop, 'ldsp18-w980').pricePerSheet).toBe(0)
    expect(material(shop, 'ldsp16-kr-w980').pricePerSheet).toBe(0)
    expect(material(shop, 'mdf19-paint').pricePerSheet).toBe(0)
    expect(material(shop, 'pf38-oak').slab!.pricePerMeter).toBe(0)
    expect(band(shop, 'abs2-paint').pricePerMeter).toBe(0)
    expect(hardware(shop, 'shelf-pin-5').pricePerUnit).toBe(0)
    expect(hardware(shop, 'minifix-15').pricePerUnit).toBe(0)
    expect(hardware(shop, 'hinge-overlay').pricePerUnit).toBe(0)
    expect(shop.services.packing.rate).toBe(0)
    expect(shop.services.assembly.rate).toBe(0)
    expect(shop.installation.ratePerMetreWidth).toBe(0)
    expect(priceOrigin(shop, 'material:ldsp18-w980')).toBe('empty')
  })

  it('барлық баға бүтін тиын', () => {
    for (const m of shop.materials) expect(Number.isInteger(m.pricePerSheet)).toBe(true)
    for (const b of shop.edgeBands) expect(Number.isInteger(b.pricePerMeter)).toBe(true)
    for (const h of shop.hardware) expect(Number.isInteger(h.pricePerUnit)).toBe(true)
  })

  it('белсенді прайс-парақ та сол бағаны және белгіні сақтайды', () => {
    const list = shop.priceLists.find((l) => l.id === shop.activePriceListId)!
    expect(list.materialPrices['ldsp16-w980']!.pricePerSheet).toBe(2_687_000)
    expect(list.marketPrices['material:ldsp16-w980']).toBeDefined()
  })

  it('§6: нарық бағасы смета жолына panels арқылы түседі', () => {
    const catalog = catalogOf(shop)
    const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
    const panels = generateCabinet({ ...cabinet, carcassMaterialId: 'ldsp16-w980' }, catalog)
    const nesting = nestPanels(panels, catalog, nestingOptionsOf(shop))
    const price = priceProject(panels, nesting, shop, [])
    const row = price.byMaterial.find((m) => m.materialId === 'ldsp16-w980')!
    expect(row.sheets).toBeGreaterThan(0)
    expect(row.materialCost).toBe(row.sheets * 2_687_000)
    expect(price.missingPrices.some((s) => s.includes('ЛДСП Белый платиновый W980 16 мм'))).toBe(false)
  })
})

describe('өз бағасы', () => {
  it('цех өзгерткен баға «өз бағасы» болады, белгі өшеді', () => {
    const shop = starterShopProfile()
    const edited = syncActivePriceList({
      ...shop,
      materials: shop.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 2_500_000 } : m),
    })
    expect(priceOrigin(edited, 'material:ldsp16-w980')).toBe('own')
    expect(edited.marketPrices['material:ldsp16-w980']).toBeUndefined()
    expect(priceOrigin(edited, 'material:ldsp16-u104')).toBe('market')
  })

  it('қызметтің негізі ауысса, нарық белгісі өшеді', () => {
    const shop = starterShopProfile()
    const edited = syncActivePriceList({
      ...shop, services: { ...shop.services, cutting: { basis: 'squareMetre', rate: 200_000 } },
    })
    expect(priceOrigin(edited, 'service:cutting')).toBe('own')
  })

  it('нарық жаңарғанда өз бағасы ӨЗГЕРМЕЙДІ, нарықтағысы жаңарады', () => {
    const shop = starterShopProfile()
    const own = syncActivePriceList({
      ...shop,
      materials: shop.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 2_500_000 } : m),
    })
    // Ескі деректен қалған белгі: баға мен белгі 1 ₸-ге ескі.
    const stale: ShopProfile = syncActivePriceList({
      ...own,
      materials: own.materials.map((m) => m.id === 'ldsp16-u104' ? { ...m, pricePerSheet: 100 } : m),
      marketPrices: { ...own.marketPrices,
        'material:ldsp16-u104': { group: 'ldsp-egger-16-2800x2070', priceTiyn: 100, dateSeen: '2026-01-01', offers: 1 } },
    })
    const fresh = refreshMarketPrices(stale)
    expect(material(fresh, 'ldsp16-w980').pricePerSheet).toBe(2_500_000)
    expect(material(fresh, 'ldsp16-u104').pricePerSheet).toBe(2_687_000)
    expect(fresh.marketPrices['material:ldsp16-u104']!.dateSeen).toBe('2026-09-24')
  })

  it('профиль қайта оқылғанда өз бағасы да, нарық белгісі де сақталады', () => {
    const shop = starterShopProfile()
    const own = syncActivePriceList({
      ...shop, edgeBands: shop.edgeBands.map((b) => b.id === 'pvc2-w980' ? { ...b, pricePerMeter: 9900 } : b),
    })
    const loaded = parseShopProfile(JSON.parse(JSON.stringify(own)))
    expect(band(loaded, 'pvc2-w980').pricePerMeter).toBe(9900)
    expect(priceOrigin(loaded, 'edgeBand:pvc2-w980')).toBe('own')
    expect(priceOrigin(loaded, 'edgeBand:pvc2-u104')).toBe('market')
  })
})

describe('нарық әдепкісі тек БОС позицияны толтырады', () => {
  it('бағасы бар позицияға тимейді, бос көршісін толтырады', () => {
    const base = defaultShopProfile()
    const mixed = {
      ...base, materials: base.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 1_111_100 } : m),
    }
    const filled = applyMarketDefaults(mixed)
    expect(material(filled, 'ldsp16-w980').pricePerSheet).toBe(1_111_100)
    expect(filled.marketPrices['material:ldsp16-w980']).toBeUndefined()
    expect(material(filled, 'ldsp16-u104').pricePerSheet).toBe(2_687_000)
  })

  it('негізі басқа қызметке тимейді', () => {
    const base = defaultShopProfile()
    const filled = applyMarketDefaults({ ...base, services: { ...base.services, cutting: { basis: 'squareMetre', rate: 0 } } })
    expect(filled.services.cutting).toEqual({ basis: 'squareMetre', rate: 0 })
  })
})

describe('нарық бағасына қайтару', () => {
  it('бір позиция: өз бағасы нарыққа қайтады, белгісі қайта қойылады', () => {
    const shop = starterShopProfile()
    const own = syncActivePriceList({
      ...shop, hardware: shop.hardware.map((h) => h.id === 'confirmat-7x50' ? { ...h, pricePerUnit: 3500 } : h),
    })
    const back = resetToMarket(own, 'hardware:confirmat-7x50')
    expect(hardware(back, 'confirmat-7x50').pricePerUnit).toBe(2000)
    expect(priceOrigin(back, 'hardware:confirmat-7x50')).toBe('market')
    const list = back.priceLists.find((l) => l.id === back.activePriceListId)!
    expect(list.hardwarePrices['confirmat-7x50']).toBe(2000)
  })

  it('нарық дерегі жоқ позицияны қайтару ештеңені өзгертпейді', () => {
    const shop = starterShopProfile()
    expect(resetToMarket(shop, 'hardware:shelf-pin-5')).toEqual(shop)
  })

  it('бәрі: барлық өз бағасы нарыққа қайтады, дерегі жоқтар өзгермейді', () => {
    const shop = starterShopProfile()
    const own = syncActivePriceList({
      ...shop,
      materials: shop.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 1 }
        : m.id === 'ldsp18-w980' ? { ...m, pricePerSheet: 3_000_000 } : m),
      services: { ...shop.services, drilling: { basis: 'panel', rate: 777 } },
    })
    const back = resetAllToMarket(own)
    expect(material(back, 'ldsp16-w980').pricePerSheet).toBe(2_687_000)
    expect(material(back, 'ldsp18-w980').pricePerSheet).toBe(3_000_000)
    expect(back.services.drilling).toEqual({ basis: 'hole', rate: 3500 })
    expect(priceOrigin(back, 'service:drilling')).toBe('market')
  })
})

describe('миграция v8 → v9', () => {
  it('бағасы мүлде бос ескі цех нарық бағасымен толады', () => {
    const loaded = parseShopProfile(legacyV8(defaultShopProfile('old-empty')))
    expect(loaded.schemaVersion).toBe(9)
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(2_687_000)
    expect(priceOrigin(loaded, 'material:ldsp16-w980')).toBe('market')
  })

  it('өз бағасын енгізген цехта ЕШТЕҢЕ ауыспайды — бос позициялар да бос қалады', () => {
    const base = defaultShopProfile('old-priced')
    const priced = syncActivePriceList({
      ...base, materials: base.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 2_400_000 } : m),
    })
    const loaded = parseShopProfile(legacyV8(priced))
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(2_400_000)
    expect(material(loaded, 'ldsp16-u104').pricePerSheet).toBe(0)
    expect(band(loaded, 'pvc2-w980').pricePerMeter).toBe(0)
    expect(loaded.services.cutting.rate).toBe(0)
    expect(loaded.marketPrices).toEqual({})
    expect(priceOrigin(loaded, 'material:ldsp16-w980')).toBe('own')
  })

  it('тек қызмет бағасы бар цех та «бағасы бар» саналады', () => {
    const base = defaultShopProfile('old-services')
    const priced = syncActivePriceList({ ...base, installation: { ratePerMetreWidth: 500_000 } })
    const loaded = parseShopProfile(legacyV8(priced))
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(0)
    expect(hasNoPrices(loaded)).toBe(false)
  })

  it('басқа прайс-парақта бағасы бар цех толтырылмайды', () => {
    const base = defaultShopProfile('old-lists')
    const withList = syncActivePriceList({
      ...base, hardware: base.hardware.map((h) => h.id === 'shelf-pin-5' ? { ...h, pricePerUnit: 500 } : h),
    })
    const blank = createPriceList(withList, 'Пустой', 'blank')
    const loaded = parseShopProfile(legacyV8(blank))
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(0)
  })

  it('v9 бос цех (әдейі нөл) қайта оқылғанда толтырылмайды', () => {
    const loaded = parseShopProfile(JSON.parse(JSON.stringify(defaultShopProfile('v9-empty'))))
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(0)
  })
})

describe('прайс-парақтар мен өндіріс профилі', () => {
  it('басқа прайсқа ауысып қайтқанда белгі сақталады', () => {
    const shop = starterShopProfile()
    const blank = createPriceList(shop, 'Пустой', 'blank')
    expect(blank.marketPrices).toEqual({})
    expect(material(blank, 'ldsp16-w980').pricePerSheet).toBe(0)
    const back = switchPriceList(blank, shop.activePriceListId)
    expect(priceOrigin(back, 'material:ldsp16-w980')).toBe('market')
  })

  it('өндіріс профилінде нарық белгісі (ақша) қалмайды', () => {
    const production = toProductionShopProfile(starterShopProfile())
    expect(production.marketPrices).toEqual({})
    for (const list of production.priceLists) expect(list.marketPrices).toEqual({})
  })
})
