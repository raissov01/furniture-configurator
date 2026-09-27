/**
 * Нарық бағасы — жаңа цехтың ӘДЕПКІ бағасы (пайдаланушы шешімі, 09-26).
 *
 * Ереже: медиана тек ашық ұсыныстардан, бүтін тиынмен; дерегі жоқ позиция
 * БОС қалады (§10); цех өзгерткен баға «өз бағасы» — нарық жаңарғанда да,
 * профиль қайта оқылғанда да өзгермейді.
 */
import { describe, expect, it } from 'vitest'
import {
  MARKET_DEFAULTS, MARKET_GROUPS, RECOMMENDED_PRICES, RECOMMENDED_PRICE_DATE, RECOMMENDED_PRICE_SOURCE,
  MARKET_MEDIAN_SOURCE, marketQuote, applyMarketDefaults, MARKET_PRICE_DATE, MARKET_PRICE_DATE_0927, createPriceList, defaultShopProfile,
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

  it('әр ұсыныс бүтін теңге, сілтемесі бар, күні — зерттеу күндерінің бірі', () => {
    for (const group of MARKET_GROUPS) {
      expect(group.offers.length, group.id).toBeGreaterThan(0)
      expect([MARKET_PRICE_DATE, MARKET_PRICE_DATE_0927], group.id).toContain(group.dateSeen)
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

  it('ЛДСП Egger 16 мм 2800×2070 — ұсынылған баға, нарық медианасы белгіде салыстыруға қалады', () => {
    expect(material(shop, 'ldsp16-w980').pricePerSheet).toBe(3_400_000)
    expect(priceOrigin(shop, 'material:ldsp16-w980')).toBe('market')
    expect(shop.marketPrices['material:ldsp16-w980']).toEqual({
      source: RECOMMENDED_PRICE_SOURCE, priceTiyn: 3_400_000, dateSeen: '2026-09-26',
      group: 'ldsp-egger-16-2800x2070', marketMedianTiyn: 2_687_000, offers: 7,
    })
  })

  it('ұсынылған бағасы жоқ позициялар нарық медианасында қалады (ХДФ, МДФ, кромка, т.б.)', () => {
    expect(material(shop, 'hdf3-white').pricePerSheet).toBe(750_000)
    expect(material(shop, 'mdf16-paint').pricePerSheet).toBe(2_095_000)
    expect(band(shop, 'pvc04-w980').pricePerMeter).toBe(3300)
    expect(band(shop, 'pvc2-h1145').pricePerMeter).toBe(14_100)
    expect(shop.marketPrices['edgeBand:pvc04-w980']).toMatchObject({ source: MARKET_MEDIAN_SOURCE, priceTiyn: 3300 })
    expect(shop.services.cutting).toEqual({ basis: 'sheet', rate: 200_000 })
    expect(shop.services.drilling).toEqual({ basis: 'sheet', rate: 500_000 })
    expect(shop.services.edging).toEqual({ basis: 'edgeMetre', rate: 17_250 })
  })

  it('2026-09-27 деректері: бос қалған фурнитура толады (медиана, N)', () => {
    const cases: [string, number, number][] = [
      ['confirmat-cap', 300, 1],
      ['hinge-plate', 14_300, 2],
      ['handle-bar', 96_000, 2],
      ['handle-rail', 73_700, 5],
      ['minifix-15', 5800, 1],
      ['runner-ball-400', 100_400, 1],
    ]
    for (const [id, price, n] of cases) {
      expect(hardware(shop, id).pricePerUnit, id).toBe(price)
      expect(shop.marketPrices[`hardware:${id}`], id).toMatchObject({ priceTiyn: price, offers: n, dateSeen: '2026-09-27' })
    }
  })

  it('қызмет: кромкалау 2 ұсыныстан (DAMEN 150, ДСП Центр 195), 2026-09-27', () => {
    expect(marketMedianTiyn(marketGroup('service-edging-metre')!)).toBe(17_250)
    expect(shop.marketPrices['service:edging']).toMatchObject({ offers: 2, dateSeen: '2026-09-27' })
  })

  it('дерегі жоқ позиция БОС қалады — ойдан баға жоқ', () => {
    expect(material(shop, 'ldsp18-w980').pricePerSheet).toBe(0)
    expect(material(shop, 'ldsp16-kr-w980').pricePerSheet).toBe(0)
    expect(material(shop, 'mdf19-paint').pricePerSheet).toBe(0)
    expect(material(shop, 'pf38-oak').slab!.pricePerMeter).toBe(0)
    expect(band(shop, 'abs2-paint').pricePerMeter).toBe(0)
    expect(material(shop, 'ldsp18-h1145').pricePerSheet).toBe(0)
    expect(band(shop, 'abs2-paint').pricePerMeter).toBe(0)
    // Бірлігі/түрі сәйкес ұсыныс жоқ немесе расталмаған (SUMMARY 2026-09-27):
    for (const id of [
      'hinge-overlay', 'hinge-boyard-none', 'hinge-hafele-none', 'hinge-blum-none', 'hinge-dtc-none',
      'runner-roller-400', 'lift-flap', 'leg-100', 'leg-cone', 'rod-bracket', 'sliding-track', 'sliding-kit',
      'handle-bracket', 'handle-rail-thin', 'filling-pantograph', 'filling-rotary-shelf', 'filling-pullout-hanger',
      'filling-rail-profile',
    ]) expect(hardware(shop, id).pricePerUnit, id).toBe(0)
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
    expect(list.materialPrices['ldsp16-w980']!.pricePerSheet).toBe(3_400_000)
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
    expect(row.materialCost).toBe(row.sheets * 3_400_000)
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
    expect(material(fresh, 'ldsp16-u104').pricePerSheet).toBe(3_400_000)
    expect(fresh.marketPrices['material:ldsp16-u104']).toMatchObject({ source: RECOMMENDED_PRICE_SOURCE, dateSeen: '2026-09-26' })
  })

  it('жаңа топтағы позиция: өз бағасы нарық жаңарғанда да ӨЗГЕРМЕЙДІ', () => {
    const shop = starterShopProfile()
    const own = syncActivePriceList({
      ...shop, hardware: shop.hardware.map((h) => h.id === 'shelf-pin-5' ? { ...h, pricePerUnit: 1000 } : h),
    })
    const fresh = refreshMarketPrices(own)
    expect(hardware(fresh, 'shelf-pin-5').pricePerUnit).toBe(1000)
    expect(priceOrigin(fresh, 'hardware:shelf-pin-5')).toBe('own')
    expect(priceOrigin(fresh, 'hardware:hinge-plate')).toBe('market')
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
    expect(material(filled, 'ldsp16-u104').pricePerSheet).toBe(3_400_000)
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
    expect(hardware(back, 'confirmat-7x50').pricePerUnit).toBe(800)
    expect(priceOrigin(back, 'hardware:confirmat-7x50')).toBe('market')
    const list = back.priceLists.find((l) => l.id === back.activePriceListId)!
    expect(list.hardwarePrices['confirmat-7x50']).toBe(800)
  })

  it('нарық дерегі жоқ позицияны қайтару ештеңені өзгертпейді', () => {
    const shop = starterShopProfile()
    expect(resetToMarket(shop, 'hardware:lift-flap')).toEqual(shop)
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
    expect(material(back, 'ldsp16-w980').pricePerSheet).toBe(3_400_000)
    expect(material(back, 'ldsp18-w980').pricePerSheet).toBe(3_000_000)
    expect(back.services.drilling).toEqual({ basis: 'sheet', rate: 500_000 })
    expect(priceOrigin(back, 'service:drilling')).toBe('market')
  })
})

describe('миграция v8 → v9', () => {
  it('бағасы мүлде бос ескі цех нарық бағасымен толады', () => {
    const loaded = parseShopProfile(legacyV8(defaultShopProfile('old-empty')))
    expect(loaded.schemaVersion).toBe(10)
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(3_400_000)
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

describe('ұсынылған баға (26.09.2026): біздің позицияларға ғана, тек сан', () => {
  const shop = starterShopProfile('rec')

  it('дереккөзі мен күні тұрақты', () => {
    expect(RECOMMENDED_PRICE_SOURCE).toBe('qdesign-2026-09-26')
    expect(RECOMMENDED_PRICE_DATE).toBe('2026-09-26')
  })

  it('әр ұсыныс бар позицияға нұсқайды және бүтін тиын', () => {
    const base = defaultShopProfile()
    for (const [key, entry] of Object.entries(RECOMMENDED_PRICES)) {
      expect(Number.isInteger(entry.priceTiyn) && entry.priceTiyn > 0, key).toBe(true)
      const [kind, id] = key.split(':')
      const exists = kind === 'material' ? base.materials.some((m) => m.id === id)
        : kind === 'hardware' ? base.hardware.some((h) => h.id === id)
          : kind === 'service' ? id! in base.services : false
      expect(exists, key).toBe(true)
    }
  })

  it('сәйкес позиция ұсынылған бағамен толады, нарық медианасы (бар болса) белгіде', () => {
    const cases: [string, number, number | undefined][] = [
      ['material:ldsp16-u104', 3_400_000, 2_687_000],
      ['material:ldsp16-h1145', 3_400_000, 2_687_000],
      ['material:ldsp16-h3303', 3_400_000, 2_687_000],
      ['hardware:hinge-blum-soft', 290_000, 213_600],
      ['hardware:hinge-hettich-soft', 160_000, 158_100],
      ['hardware:hinge-hafele-soft', 140_000, undefined],
      ['hardware:hinge-gtv-soft', 90_000, 55_700],
      ['hardware:hinge-dtc-soft', 65_000, undefined],
      ['hardware:hinge-boyard-soft', 45_000, 43_200],
      ['hardware:runner-tandem', 1_200_000, 968_450],
      ['hardware:box-merivobox', 2_800_000, undefined],
      ['hardware:box-tandembox', 3_200_000, 3_212_200],
      ['hardware:box-legrabox', 4_500_000, 5_579_700],
      ['hardware:confirmat-7x50', 800, 2000],
      ['hardware:dowel-8x30', 400, 400],
      ['hardware:shelf-pin-5', 1200, 600],
      ['hardware:rod-25', 70_000, undefined],
      ['hardware:filling-trousers', 2_800_000, undefined],
      ['service:cutting', 200_000, 200_000],
      ['service:packing', 200_000, undefined],
    ]
    for (const [key, price, median] of cases) {
      const mark = shop.marketPrices[key]
      expect(mark, key).toMatchObject({ source: RECOMMENDED_PRICE_SOURCE, priceTiyn: price, dateSeen: '2026-09-26' })
      expect(mark?.marketMedianTiyn, key).toBe(median)
      expect(priceOrigin(shop, key), key).toBe('market')
    }
    expect(shop.services.packing).toEqual({ basis: 'sheet', rate: 200_000 })
    expect(hardware(shop, 'rod-25').pricePerUnit).toBe(70_000)
  })

  it('сәйкестігі жоқтар ұсынылған бағаны АЛМАЙДЫ: кромка, ЛДСП 18, Kronospan 2750, ХДФ 3, МДФ, тұтқа, ножка, минификс, брендсіз бағыттағыш', () => {
    for (const key of [
      'edgeBand:pvc04-w980', 'edgeBand:pvc1-u104', 'edgeBand:pvc2-h3303', 'edgeBand:abs2-paint',
      'material:ldsp18-w980', 'material:ldsp16-kr-w980', 'material:hdf3-white', 'material:mdf16-paint',
      'material:mdf19-paint', 'hardware:handle-bar', 'hardware:handle-rail', 'hardware:leg-100',
      'hardware:minifix-15', 'hardware:runner-ball', 'hardware:runner-ball-400', 'hardware:hinge-overlay',
      'hardware:hinge-blum-none', 'hardware:filling-rail-profile', 'service:edging', 'service:assembly',
    ]) {
      expect(RECOMMENDED_PRICES[key], key).toBeUndefined()
      expect(shop.marketPrices[key]?.source ?? MARKET_MEDIAN_SOURCE, key).toBe(MARKET_MEDIAN_SOURCE)
    }
  })

  it('кесте ұсыныстың бірлігі біздікімен сәйкес: қызмет негізі бірдей', () => {
    expect(RECOMMENDED_PRICES['service:cutting']!.basis).toBe('sheet')
    expect(RECOMMENDED_PRICES['service:packing']!.basis).toBe('sheet')
  })

  it('квота: ұсынылған баға мен нарық медианасы бөлек көрінеді', () => {
    const q = marketQuote('hardware:hinge-blum-soft')!
    expect(q.source).toBe(RECOMMENDED_PRICE_SOURCE)
    expect(q.priceTiyn).toBe(290_000)
    expect(q.market).toMatchObject({ priceTiyn: 213_600, offers: 1, dateSeen: '2026-09-24' })
    expect(marketQuote('hardware:box-merivobox')!.market).toBeNull()
    expect(marketQuote('edgeBand:pvc04-w980')!.source).toBe(MARKET_MEDIAN_SOURCE)
  })

  it('«своя» баға ұсынылған баға келгенде де ӨЗГЕРМЕЙДІ, ↺ жаңа әдепкіге қайтарады', () => {
    const own = syncActivePriceList({
      ...shop, hardware: shop.hardware.map((h) => h.id === 'hinge-blum-soft' ? { ...h, pricePerUnit: 250_000 } : h),
    })
    const loaded = parseShopProfile(JSON.parse(JSON.stringify(own)))
    expect(hardware(loaded, 'hinge-blum-soft').pricePerUnit).toBe(250_000)
    expect(priceOrigin(loaded, 'hardware:hinge-blum-soft')).toBe('own')
    const back = resetToMarket(loaded, 'hardware:hinge-blum-soft')
    expect(hardware(back, 'hinge-blum-soft').pricePerUnit).toBe(290_000)
    expect(back.marketPrices['hardware:hinge-blum-soft']!.source).toBe(RECOMMENDED_PRICE_SOURCE)
  })

  it('ескі нарық белгісі (source жоқ) профиль оқылғанда ұсынылған бағаға көшеді', () => {
    const legacyMark = syncActivePriceList({
      ...shop,
      materials: shop.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 2_687_000 } : m),
      marketPrices: { ...shop.marketPrices,
        'material:ldsp16-w980': { group: 'ldsp-egger-16-2800x2070', priceTiyn: 2_687_000, dateSeen: '2026-09-24', offers: 7 } },
    })
    const loaded = parseShopProfile(JSON.parse(JSON.stringify(legacyMark)))
    expect(material(loaded, 'ldsp16-w980').pricePerSheet).toBe(3_400_000)
    expect(loaded.marketPrices['material:ldsp16-w980']!.source).toBe(RECOMMENDED_PRICE_SOURCE)
  })

  it('ескі нарық белгісі (кромка) бағасы сол күйі қалып, дереккөз бен медианамен толығады', () => {
    const legacy = syncActivePriceList({
      ...shop,
      marketPrices: { ...shop.marketPrices,
        'edgeBand:pvc04-w980': { group: 'edge-pvc-04-19', priceTiyn: 3300, dateSeen: '2026-09-24', offers: 2 } },
    })
    const loaded = parseShopProfile(JSON.parse(JSON.stringify(legacy)))
    expect(band(loaded, 'pvc04-w980').pricePerMeter).toBe(3300)
    expect(loaded.marketPrices['edgeBand:pvc04-w980']).toEqual({
      source: MARKET_MEDIAN_SOURCE, group: 'edge-pvc-04-19', priceTiyn: 3300, dateSeen: '2026-09-24', offers: 2,
      marketMedianTiyn: 3300,
    })
  })
})
