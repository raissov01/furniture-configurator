/**
 * Цех профилі (SaaS негізі).
 *
 * Басты талап: бір цехтың ақиқаты кодта болмауы керек. Сондықтан жаңа
 * профиль БАҒАСЫЗ келеді, ал баға толтырылмайынша КП шығаруға тыйым салынады —
 * ойдан жазылған баға клиентке кеткен КП-ға түседі (§6).
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  catalogOf,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  mergeSettings,
  parseShopProfile,
  shelfSpanWarnings,
  shopReadiness,
  templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'

const shop = defaultShopProfile()

describe('цех профилі', () => {
  it('жаңа профильде БАРЛЫҚ баға нөл', () => {
    expect(shop.materials.every((m) => m.pricePerSheet === 0)).toBe(true)
    expect(shop.edgeBands.every((b) => b.pricePerMeter === 0)).toBe(true)
    expect(shop.hardware.every((h) => h.pricePerUnit === 0)).toBe(true)
  })

  it('сөре пролётінің шегі әдепкіде ЖОҚ', () => {
    expect(shop.maxShelfSpan).toBeNull()
  })

  it('профиль каталогымен шкаф жиналады', () => {
    const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalogOf(shop))
    expect(generateCabinet(cabinet, catalogOf(shop))).toHaveLength(11)
  })

  it('профильдің константалары әдепкінің үстіне жабылады', () => {
    const custom: ShopProfile = { ...shop, settings: { frontGap: 4, shelfSetback: 15 } }
    const merged = mergeSettings(custom.settings)
    expect(merged.frontGap).toBe(4)
    expect(merged.shelfSetback).toBe(15)
    // Қалғаны әдепкіден мұраланады.
    expect(merged.shelfGap).toBe(DEFAULT_SETTINGS.shelfGap)
  })
})

describe('КП-ға дайындық', () => {
  it('бағасыз профиль дайын емес', () => {
    const { pricingReady, issues } = shopReadiness(shop)
    expect(pricingReady).toBe(false)
    expect(issues.some((i) => i.area === 'material')).toBe(true)
  })

  it('тек ҚОЛДАНЫЛАТЫН материалдың бағасы тексеріледі', () => {
    const priced: ShopProfile = {
      ...shop,
      name: 'Цех «Алаш»',
      materials: shop.materials.map((m) =>
        m.id === 'ldsp16-h1145' || m.id === 'hdf3-white' ? { ...m, pricePerSheet: 2850000 } : m,
      ),
      edgeBands: shop.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
    }
    // Каталогтың қалғаны әлі бағасыз, бірақ бұл жоба оларды қолданбайды.
    const { pricingReady } = shopReadiness(priced, ['ldsp16-h1145', 'hdf3-white'])
    expect(pricingReady).toBe(true)
    // Ал бүкіл каталогты тексерсек — дайын емес.
    expect(shopReadiness(priced).pricingReady).toBe(false)
  })

  it('цех аты жоқтығы КП-ны бөгемейді, бірақ ескертіледі', () => {
    const priced: ShopProfile = {
      ...shop,
      materials: shop.materials.map((m) => ({ ...m, pricePerSheet: 1 })),
      edgeBands: shop.edgeBands.map((b) => ({ ...b, pricePerMeter: 1 })),
    }
    const { pricingReady, issues } = shopReadiness(priced)
    expect(pricingReady).toBe(true)
    expect(issues.some((i) => i.area === 'profile' && i.id === 'name')).toBe(true)
  })
})

describe('сөре пролёті', () => {
  const cabinet = templateToCabinet(findTemplate('bookcase-2sec-1200')!, catalogOf(shop))
  const panels = generateCabinet(cabinet, catalogOf(shop))

  it('шек қойылмаса ЕШҚАНДАЙ ескерту жоқ', () => {
    expect(shelfSpanWarnings(panels, shop)).toEqual([])
  })

  it('шектен ұзын сөрелер ғана ескертіледі', () => {
    const strict: ShopProfile = { ...shop, maxShelfSpan: 500 }
    const warnings = shelfSpanWarnings(panels, strict)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.every((w) => w.span > 500 && w.limit === 500)).toBe(true)
    expect(warnings.every((w) => w.label.includes('Полка'))).toBe(true)
  })

  it('шек кең болса ескерту жоқ', () => {
    expect(shelfSpanWarnings(panels, { ...shop, maxShelfSpan: 2000 })).toEqual([])
  })
})

describe('профильді сақтау', () => {
  it('сақталған профиль қайта оқылады', () => {
    const round = parseShopProfile(JSON.parse(JSON.stringify(shop)))
    expect(round).toEqual(shop)
  })

  it('бүлінген профиль үнсіз өтпейді', () => {
    expect(() => parseShopProfile({ ...shop, materials: [] })).toThrow()
    expect(() => parseShopProfile({ ...shop, schemaVersion: 99 })).toThrow()
    expect(() => parseShopProfile({ ...shop, maxShelfSpan: -5 })).toThrow()
  })

  it('баға бүтін тиын болуы керек, float емес', () => {
    const broken = { ...shop, materials: shop.materials.map((m) => ({ ...m, pricePerSheet: 1250.5 })) }
    expect(() => parseShopProfile(broken)).toThrow()
  })
})
