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
  SHEET_FORMATS,
  catalogOf,
  cloneMaterial,
  defaultLimits,
  defaultShopProfile,
  dimensionWarningText,
  dimensionWarnings,
  findTemplate,
  generateCabinet,
  makeMaterial,
  mergeSettings,
  parseShopProfile,
  shelfSpanWarnings,
  shopReadiness,
  templateToCabinet,
} from '../src/core/index'
import type { Material, ShopProfile } from '../src/core/index'

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

describe('цехтың өз материалы', () => {
  it('жаңа материалдың бағасы ӘРҚАШАН нөлден басталады', () => {
    const m = makeMaterial({
      id: 'own-1', name: 'ЛДСП Дуб Сонома 16 мм', thickness: 16,
      sheetWidth: 2800, sheetHeight: 2070, hasGrain: true, color: '#c9a227',
    })
    expect(m.pricePerSheet).toBe(0)
    expect(m.decor).toEqual({ color: '#c9a227', kind: 'wood' })
  })

  it('текстурасыз материал solid болады — раскройда бұруға болады', () => {
    const m = makeMaterial({
      id: 'own-2', name: 'ЛДСП Белый 16 мм', thickness: 16,
      sheetWidth: 2800, sheetHeight: 2070, hasGrain: false, color: '#eeece7',
    })
    expect(m.decor!.kind).toBe('solid')
    expect(m.hasGrain).toBe(false)
  })

  it('қосылған материалмен шкаф жиналады', () => {
    const own = makeMaterial({
      id: 'own-3', name: 'ЛДСП Свой 18 мм', thickness: 18,
      sheetWidth: 2750, sheetHeight: 1830, hasGrain: false, color: '#9c9a94',
      edging: { visibleFront: shop.edgeBands[0]!.id, visibleSecondary: null },
    })
    const withOwn: ShopProfile = { ...shop, materials: [...shop.materials, own] }
    const cabinet = {
      ...templateToCabinet(findTemplate('wardrobe-penal-600')!, catalogOf(withOwn)),
      carcassMaterialId: own.id,
      frontMaterialId: own.id,
    }
    expect(() => generateCabinet(cabinet, catalogOf(withOwn))).not.toThrow()
  })

  it('стандарт форматтар тізімі бос емес әрі өлшемдері бүтін', () => {
    expect(SHEET_FORMATS.length).toBeGreaterThan(4)
    for (const f of SHEET_FORMATS) {
      expect(Number.isInteger(f.width)).toBe(true)
      expect(Number.isInteger(f.height)).toBe(true)
      expect(f.width).toBeGreaterThan(f.height)
    }
  })
})

describe('материалды клондау', () => {
  const original: Material = {
    id: 'egger-h1145', name: 'ЛДСП Egger H1145', thickness: 18,
    sheetWidth: 2800, sheetHeight: 2070, hasGrain: true,
    pricePerSheet: 2850000, trimEdge: 12,
    defaultEdging: { visibleFront: 'band-2', visibleSecondary: 'band-04', hidden: null },
    decor: {
      color: '#b69770', kind: 'wood', finish: 'satin',
      mapUrl: 'https://example.com/H1145.jpg', mapSizeMm: { x: 900, y: 600 },
    },
    slab: { stockLengths: [3050, 4100], pricePerMeter: 123400 },
  }

  it('жаңа id бірегей, аты ажыратылады; барлық физикалық және бағалық қасиет сақталады', () => {
    const copy = cloneMaterial(original, [original.id, 'egger-h1145-copy', 'band-2'])
    expect(copy.id).toBe('egger-h1145-copy-2')
    expect(copy.name).toBe('ЛДСП Egger H1145 (копия)')
    expect({ ...copy, id: original.id, name: original.name }).toEqual(original)
    expect(original.id).toBe('egger-h1145')
    expect(copy).not.toBe(original)
  })

  it('екі рет клондағанда id қайталанбайды, профиль схемасынан өтеді', () => {
    const first = cloneMaterial(original, [original.id])
    const second = cloneMaterial(original, [original.id, first.id])
    expect([first.id, second.id]).toEqual(['egger-h1145-copy', 'egger-h1145-copy-2'])
    const saved = { ...shop, materials: [...shop.materials, original, first, second] }
    expect(parseShopProfile(saved).materials.slice(-2)).toEqual([first, second])
  })

  it('ішкі объектілер де бөлек: көшірмені өңдеу түпнұсқаға тимейді', () => {
    const copy = cloneMaterial(original, [original.id])
    copy.defaultEdging!.visibleFront = 'other-band'
    copy.decor!.color = '#ffffff'
    copy.decor!.mapSizeMm!.x = 450
    copy.slab!.stockLengths[0] = 2500
    copy.slab!.pricePerMeter = 432100
    expect(original.defaultEdging!.visibleFront).toBe('band-2')
    expect(original.decor).toMatchObject({ color: '#b69770', mapSizeMm: { x: 900, y: 600 } })
    expect(original.slab).toEqual({ stockLengths: [3050, 4100], pricePerMeter: 123400 })
  })
})

/**
 * Габарит шектері.
 *
 * Ең маңызды тексеріс — БІРІНШІСІ: жаңа профильде шек жоқ. Егер кодта әдепкі
 * сан тұрса, оны қоймаған цехтың бәріне ЖАЛҒАН ескерту шығар еді.
 */
describe('габарит шектері', () => {
  const box = { id: 'c1', name: 'Пенал', width: 600, height: 2000, depth: 560 }

  it('жаңа профильде шек ЖОҚ, сондықтан ескерту де жоқ', () => {
    expect(shop.limits).toEqual({
      minHeight: null, maxHeight: null,
      minWidth: null, maxWidth: null,
      minDepth: null, maxDepth: null,
    })
    expect(dimensionWarnings([{ ...box, height: 9000 }], shop)).toEqual([])
  })

  it('жоғарғы шектен асқан габарит ескертіледі', () => {
    const limited: ShopProfile = { ...shop, limits: { ...shop.limits, maxHeight: 2750 } }
    const [w, ...rest] = dimensionWarnings([{ ...box, height: 2900 }], limited)
    expect(rest).toHaveLength(0)
    expect(w).toMatchObject({ cabinetId: 'c1', axis: 'height', value: 2900, limit: 2750, side: 'max' })
    expect(dimensionWarningText(w!)).toBe('Высота 2900 мм — больше предела цеха (2750 мм)')
  })

  it('төменгі шектен кіші габарит те ескертіледі', () => {
    const limited: ShopProfile = { ...shop, limits: { ...shop.limits, minDepth: 200 } }
    const [w] = dimensionWarnings([{ ...box, depth: 150 }], limited)
    expect(w).toMatchObject({ axis: 'depth', value: 150, limit: 200, side: 'min' })
    expect(dimensionWarningText(w!)).toBe('Глубина 150 мм — меньше предела цеха (200 мм)')
  })

  it('шектің дәл өзі — ескерту емес', () => {
    const limited: ShopProfile = {
      ...shop,
      limits: { ...shop.limits, maxWidth: 600, minWidth: 600 },
    }
    expect(dimensionWarnings([box], limited)).toEqual([])
  })

  it('бір корпустан бірнеше ескерту шығады: қайсысын қысқарту керегі көрінеді', () => {
    const limited: ShopProfile = {
      ...shop,
      limits: { ...shop.limits, maxWidth: 900, maxHeight: 2400, maxDepth: 600 },
    }
    const warnings = dimensionWarnings([{ ...box, width: 1200, height: 2900 }], limited)
    expect(warnings.map((w) => w.axis)).toEqual(['height', 'width'])
  })

  it('тексеру БҮКІЛ жоба бойынша жүреді, тек белсенді корпус емес', () => {
    const limited: ShopProfile = { ...shop, limits: { ...shop.limits, maxWidth: 800 } }
    const warnings = dimensionWarnings(
      [box, { ...box, id: 'c2', name: 'Тумба', width: 1200 }],
      limited,
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.cabinetName).toBe('Тумба')
  })

  it('5-нұсқадағы профиль көтерілгенде шектер БОС келеді, бағалары сақталады', () => {
    const old = { ...defaultShopProfile(), schemaVersion: 5, markupPercent: 25 }
    delete (old as { limits?: unknown }).limits

    const migrated = parseShopProfile(old)
    expect(migrated.schemaVersion).toBe(10)
    expect(migrated.limits).toEqual(defaultLimits())
    expect(migrated.markupPercent).toBe(25)
  })
})
