/**
 * Присадканың бірлігін цех таңдайды (пайдаланушы шешімі, 2026-09-27):
 * тесікке (бұрынғы), параққа (раскройдың парақ саны), бөлшекке (тесігі бар
 * бөлшек саны). Жаңа цех — параққа, 5 000 ₸ (ұсынылған баға); бар цех
 * тесікте ҚАЛАДЫ. Жол панельдерге дейін ізделеді (§6).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { serviceLineText, unitLabel } from '../lib/priceUnits'
import { setLang } from '../lib/i18n'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'
import {
  MARKET_MEDIAN_SOURCE, RECOMMENDED_PRICE_SOURCE, catalogOf, defaultShopProfile, findTemplate, generateCabinet,
  nestPanels, parseShopProfile, priceOrigin, priceProject, refreshMarketPrices, resetToMarket, starterShopProfile,
  syncActivePriceList, templateToCabinet,
} from '../src/core/index'
import type { PriceLine, ServiceBasis, ShopProfile } from '../src/core/index'

const base = defaultShopProfile()
const catalog = catalogOf(base)
const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
const panels = generateCabinet(cabinet, catalog)
const nesting = nestPanels(panels, catalog)

/** Тек присадка бағаланған цех (материал бағасы — «Цены не заданы» болмасын). */
function drillingOnly(basis: ServiceBasis, rate: number): ShopProfile {
  return {
    ...base,
    materials: base.materials.map((m) => ({ ...m, pricePerSheet: 100 })),
    edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 100 })),
    services: {
      cutting: { basis: 'sheet', rate: 0 },
      drilling: { basis, rate },
      edging: { basis: 'edgeMetre', rate: 0 },
      packing: { basis: 'sheet', rate: 0 },
      assembly: { basis: 'squareMetre', rate: 0 },
    },
  }
}

const drillingLine = (shop: ShopProfile): PriceLine =>
  priceProject(panels, nesting, shop, []).services.find((l) => l.id === 'service-drilling')!

// Қолмен есептелген кіріс: раскройдың парақтары, тесіктер, тесігі бар бөлшектер.
const sheets = nesting.byMaterial.reduce((s, g) => s + g.sheets.length, 0)
const holes = panels.reduce((s, p) => s + p.drilling.length, 0)
const drilledPanels = panels.filter((p) => p.drilling.length > 0).length

describe('присадка: үш бірліктің есебі', () => {
  it('кіріс мағыналы: тесіксіз бөлшек те бар', () => {
    expect(sheets).toBeGreaterThan(0)
    expect(holes).toBeGreaterThan(drilledPanels)
    expect(drilledPanels).toBeGreaterThan(0)
    expect(drilledPanels).toBeLessThan(panels.length)
  })

  it('параққа: раскройдың парақ саны × 5 000 ₸', () => {
    const line = drillingLine(drillingOnly('sheet', 500_000))
    expect(line).toMatchObject({ qty: sheets, unit: 'лист', unitPrice: 500_000, cost: sheets * 500_000 })
  })

  it('тесікке: тесік саны × 35 ₸', () => {
    const line = drillingLine(drillingOnly('hole', 3500))
    expect(line).toMatchObject({ qty: holes, unit: 'отв', unitPrice: 3500, cost: holes * 3500 })
  })

  it('бөлшекке: тек тесігі бар бөлшектер × 120 ₸', () => {
    const line = drillingLine(drillingOnly('panel', 12_000))
    expect(line).toMatchObject({ qty: drilledPanels, unit: 'дет', unitPrice: 12_000, cost: drilledPanels * 12_000 })
  })

  it('басқа қызметте «бөлшекке» бұрынғыдай — барлық бөлшек', () => {
    const shop = drillingOnly('hole', 0)
    const p = priceProject(panels, nesting, { ...shop, services: { ...shop.services, packing: { basis: 'panel', rate: 100 } } }, [])
    expect(p.services.find((l) => l.id === 'service-packing')!.qty).toBe(panels.length)
  })

  it('§6: жол материал жолдарына дейін ізделеді (парақ пен бөлшек саны, сома)', () => {
    for (const [basis, rate] of [['sheet', 500_000], ['panel', 12_000]] as const) {
      const p = priceProject(panels, nesting, drillingOnly(basis, rate), [])
      const line = p.services.find((l) => l.id === 'service-drilling')!
      expect(p.byMaterial.reduce((s, r) => s + r.services.drilling, 0), basis).toBe(line.cost)
      const traced = p.byMaterial.reduce((s, r) => s + (basis === 'sheet' ? r.sheets : r.drilledPanels), 0)
      expect(traced, basis).toBe(line.qty)
      for (const r of p.byMaterial) {
        const own = panels.filter((x) => x.materialId === r.materialId && x.drilling.length > 0).length
        expect(r.drilledPanels, r.materialId).toBe(own)
      }
    }
  })
})

describe('жаңа цех: параққа, 5 000 ₸, ұсынылған баға', () => {
  const shop = starterShopProfile('new')

  it('әдепкі — sheet 500 000 тиын, белгіде нарық медианасы (35 ₸/тесік) салыстыруға', () => {
    expect(shop.services.drilling).toEqual({ basis: 'sheet', rate: 500_000 })
    expect(priceOrigin(shop, 'service:drilling')).toBe('market')
    expect(shop.marketPrices['service:drilling']).toMatchObject({
      source: RECOMMENDED_PRICE_SOURCE, priceTiyn: 500_000, basis: 'sheet', marketMedianTiyn: 3500,
    })
  })

  it('↺ бағаны да, бірлікті де әдепкіге қайтарады', () => {
    const own = syncActivePriceList({ ...shop, services: { ...shop.services, drilling: { basis: 'hole', rate: 4000 } } })
    expect(priceOrigin(own, 'service:drilling')).toBe('own')
    const back = resetToMarket(own, 'service:drilling')
    expect(back.services.drilling).toEqual({ basis: 'sheet', rate: 500_000 })
    expect(priceOrigin(back, 'service:drilling')).toBe('market')
  })

  it('«своя» баға мен бірлік қайта оқылғанда да, жаңартуда да ауыспайды', () => {
    const own = syncActivePriceList({ ...shop, services: { ...shop.services, drilling: { basis: 'panel', rate: 70_000 } } })
    const loaded = parseShopProfile(JSON.parse(JSON.stringify(own)))
    expect(loaded.services.drilling).toEqual({ basis: 'panel', rate: 70_000 })
    expect(refreshMarketPrices(loaded).services.drilling).toEqual({ basis: 'panel', rate: 70_000 })
    expect(priceOrigin(loaded, 'service:drilling')).toBe('own')
  })

  it('тек бірлігін өзгертсе де — «своя»', () => {
    const own = syncActivePriceList({ ...shop, services: { ...shop.services, drilling: { basis: 'panel', rate: 500_000 } } })
    expect(priceOrigin(own, 'service:drilling')).toBe('own')
  })
})

/** v9 профиль: присадка тесікке, белгісі — ескі нарық медианасы (basis жоқ). */
function legacyV9(drilling: { basis: ServiceBasis; rate: number }, marked: boolean): unknown {
  const shop = starterShopProfile('v9')
  const marks: Record<string, unknown> = { ...shop.marketPrices }
  delete marks['service:drilling']
  if (marked) marks['service:drilling'] = { group: 'service-drilling-hole', priceTiyn: 3500, dateSeen: '2026-09-24', offers: 1 }
  const withDrilling = syncActivePriceList({ ...shop, services: { ...shop.services, drilling } })
  const raw = structuredClone(withDrilling) as unknown as Record<string, unknown>
  raw.schemaVersion = 9
  raw.marketPrices = marks
  raw.priceLists = (raw.priceLists as Record<string, unknown>[]).map((l) => ({ ...l, marketPrices: marks }))
  return raw
}

describe('миграция v9 → v10: бар цех тесікте ҚАЛАДЫ', () => {
  it('нарық белгісі бар присадка: 35 ₸/тесік өзгермейді, белгі тесікке байланады', () => {
    const loaded = parseShopProfile(legacyV9({ basis: 'hole', rate: 3500 }, true))
    expect(loaded.schemaVersion).toBe(10)
    expect(loaded.services.drilling).toEqual({ basis: 'hole', rate: 3500 })
    expect(priceOrigin(loaded, 'service:drilling')).toBe('market')
    expect(loaded.marketPrices['service:drilling']).toMatchObject({
      basis: 'hole', priceTiyn: 3500, source: MARKET_MEDIAN_SOURCE,
    })
    const list = loaded.priceLists.find((l) => l.id === loaded.activePriceListId)!
    expect(list.serviceRates.drilling).toBe(3500)
    expect(list.marketPrices['service:drilling']).toMatchObject({ basis: 'hole' })
  })

  it('өз бағасы (белгісіз) тесікте: баға да, бірлік те өзгермейді', () => {
    const loaded = parseShopProfile(legacyV9({ basis: 'hole', rate: 4000 }, false))
    expect(loaded.services.drilling).toEqual({ basis: 'hole', rate: 4000 })
    expect(priceOrigin(loaded, 'service:drilling')).toBe('own')
  })

  it('басқа қызмет белгісі (распил) бірлігімен бірге сақталады', () => {
    const loaded = parseShopProfile(legacyV9({ basis: 'hole', rate: 3500 }, true))
    expect(loaded.marketPrices['service:cutting']).toMatchObject({ basis: 'sheet' })
    expect(loaded.services.cutting).toEqual({ basis: 'sheet', rate: 200_000 })
  })

  it('қайта оқу тұрақты: v10 → v10 ештеңе ауыспайды', () => {
    const once = parseShopProfile(legacyV9({ basis: 'hole', rate: 3500 }, true))
    const twice = parseShopProfile(JSON.parse(JSON.stringify(once)))
    expect(twice).toEqual(once)
  })
})

describe('смета жолында бірлік көрінеді (ru/kk/en/uz)', () => {
  afterEach(() => setLang('ru'))

  const line = (unit: PriceLine['unit'], qty: number, unitPrice: number): PriceLine =>
    ({ id: 'service-drilling', name: 'Присадка', qty, unit, unitPrice, cost: qty * unitPrice })

  it('орысша', () => {
    expect(serviceLineText(line('лист', 3, 500_000))).toMatch(/^Присадка: 3 лист\. × 5\s000 ₸$/)
    expect(serviceLineText(line('отв', 142, 3500))).toBe('Присадка: 142 отв. × 35 ₸')
    expect(serviceLineText(line('дет', 18, 12_000))).toBe('Присадка: 18 дет. × 120 ₸')
  })

  it('қазақша', () => {
    setLang('kk')
    expect(serviceLineText(line('лист', 3, 500_000))).toMatch(/^Присадка: 3 парақ × 5\s000 ₸$/)
    expect(serviceLineText(line('отв', 142, 3500))).toBe('Присадка: 142 тесік × 35 ₸')
    expect(serviceLineText(line('дет', 18, 12_000))).toBe('Присадка: 18 бөлшек × 120 ₸')
  })

  it('en мен uz-да бірлік аударылған', () => {
    for (const u of ['лист', 'отв', 'дет', 'шт'] as const) {
      setLang('en')
      expect(unitLabel(u), `en ${u}`).not.toMatch(/[а-яё]/i)
      setLang('uz')
      expect(unitLabel(u), `uz ${u}`).not.toMatch(/[а-яё]/i)
    }
  })

  it('бірлік кілттері төрт тілде бар', () => {
    for (const key of ['лист.', 'отв.', 'дет.', 'шт.', '{name}: {qty} {unit} × {price}']) {
      for (const dict of [kk, en, uz]) expect(dict[key], key).toBeTruthy()
    }
  })
})
