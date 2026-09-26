/**
 * Қаржы өзегі (qdesign-тен қалған функциялар, 03g §2):
 *   - «Орнатусыз» белгісі (монтаж 1 п.м. модуль ені бойынша — бұрыннан бар);
 *   - «парақ басы» қызметтері — ҚОСЫМША цех баптауы, §6 өзгермейді;
 *   - қолмен сату бағасының ЛДСП ауданына пропорционал жаңаруы;
 *   - қаржы кестесінің жиыны.
 * Әдепкі баптауда барлық SEED_TEMPLATES сметасы тиынға дейін бірдей (эквиваленттік).
 */
import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError, SEED_TEMPLATES, captureSalePriceScaling, defaultScalingMaterialIds,
  defaultShopProfile, financeTotals, findTemplate, generateCabinet, nestPanels, parseProject,
  parseShopProfile, priceProject, scaleSalePrice, scalingAreaMm2, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel, ShopProfile } from '../src/core/index'
import { referenceProject } from './fixtures'

const base = defaultShopProfile()
const catalog = { materials: base.materials, edgeBands: base.edgeBands }

const pricedShop: ShopProfile = {
  ...base,
  materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
  edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
  services: {
    cutting: { basis: 'squareMetre', rate: 150000 },
    drilling: { basis: 'hole', rate: 3000 },
    edging: { basis: 'edgeMetre', rate: 5000 },
    packing: { basis: 'sheet', rate: 0 },
    assembly: { basis: 'squareMetre', rate: 0 },
  },
  installation: { ratePerMetreWidth: 1_000_000 },
  markupPercent: 20,
  coefficient: 2,
}

function build(cabinet: CabinetConfig): { panels: Panel[]; nesting: ReturnType<typeof nestPanels> } {
  const panels = generateCabinet(cabinet, catalog)
  return { panels, nesting: nestPanels(panels, catalog) }
}

const penal = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
const { panels, nesting } = build(penal)

describe('әдепкі баптау — смета бұрынғыдай (SEED_TEMPLATES эквиваленттігі)', () => {
  it('sheetServices өшірулі / withoutInstallation=false / масштабсыз — барлық шаблонда бірдей', () => {
    const disabled: ShopProfile = {
      ...pricedShop,
      sheetServices: { enabled: false, rates: { cutting: 50000, drilling: 40000, edging: 30000 } },
    }
    let checked = 0
    for (const template of SEED_TEMPLATES) {
      const built = build(templateToCabinet(template, catalog))
      const widths = [template.width]
      const plain = priceProject(built.panels, built.nesting, pricedShop, [], widths)
      expect(priceProject(built.panels, built.nesting, disabled, [], widths,
        { withoutInstallation: false }), template.id).toEqual(plain)
      // Масштаб тек сату бағасымен бірге жүреді: жалғыз берілсе ештеңе өзгермейді.
      const scaling = captureSalePriceScaling(built.panels, pricedShop)
      expect(priceProject(built.panels, built.nesting, pricedShop, [], widths, { salePriceScaling: scaling }),
        template.id).toEqual(plain)
      expect(plain.byMaterial.every((row) => row.sheetServices === undefined)).toBe(true)
      checked += 1
    }
    expect(checked).toBe(SEED_TEMPLATES.length)
  })
})

describe('«Орнатусыз» белгісі', () => {
  it('монтаж 1 п.м. модуль ені бойынша есептеледі, белгі қойылса — 0', () => {
    const withInstall = priceProject(panels, nesting, pricedShop, [], [600, 450])
    expect(withInstall.installation).toEqual({ metres: 1.05, rate: 1_000_000, cost: 1_050_000 })
    const without = priceProject(panels, nesting, pricedShop, [], [600, 450], { withoutInstallation: true })
    expect(without.installation).toEqual({ metres: 1.05, rate: 1_000_000, cost: 0, excluded: true })
    expect(withInstall.subtotal - without.subtotal).toBe(1_050_000)
  })

  it('цех мөлшерлемесі әдепкіде 0 — монтаж өшірулі', () => {
    expect(defaultShopProfile().installation.ratePerMetreWidth).toBe(0)
  })
})

describe('парақ басы қызметтер — ҚОСЫМША баптау', () => {
  const rates = { cutting: 50000, drilling: 40000, edging: 30000 }
  const shop: ShopProfile = { ...pricedShop, sheetServices: { enabled: true, rates } }

  it('§6 қызметтері өзгермейді, парақ басы жолдар ҮСТІНЕ қосылады', () => {
    const plain = priceProject(panels, nesting, pricedShop)
    const extra = priceProject(panels, nesting, shop)
    const plainServices = plain.services
    expect(extra.services.slice(0, plainServices.length)).toEqual(plainServices)
    const sheets = nesting.byMaterial.reduce((sum, group) => sum + group.sheets.length, 0)
    const perSheet = rates.cutting + rates.drilling + rates.edging
    expect(extra.servicesTotal - plain.servicesTotal).toBe(sheets * perSheet)
    expect(extra.goods).toBe(plain.goods)
    for (const row of extra.byMaterial) {
      expect(row.sheetServices).toEqual({
        cutting: row.sheets * rates.cutting, drilling: row.sheets * rates.drilling, edging: row.sheets * rates.edging,
      })
      const serviceSum = Object.values(row.services).reduce((sum, v) => sum + v, 0)
      expect(row.total).toBe(row.materialCost + row.edgeCost + serviceSum + row.sheets * perSheet)
    }
  })

  it('материалдың өз мөлшерлемесі ортақтың орнына жүреді', () => {
    const first = nesting.byMaterial[0]!
    const own = { cutting: 10000, drilling: 0, edging: 0 }
    const p = priceProject(panels, nesting, { ...shop, sheetServices: { enabled: true, rates, byMaterial: { [first.materialId]: own } } })
    const row = p.byMaterial.find((r) => r.materialId === first.materialId)!
    expect(row.sheetServices).toEqual({ cutting: first.sheets.length * 10000, drilling: 0, edging: 0 })
    const line = p.services.find((l) => l.id === `service-sheet-cutting-${first.materialId}`)!
    expect(line).toMatchObject({ qty: first.sheets.length, unit: 'лист', unitPrice: 10000 })
    expect(p.services.some((l) => l.id === `service-sheet-drilling-${first.materialId}`)).toBe(false)
  })

  it('жол жеңілдігі парақ басы жолға да қолданылады', () => {
    const id = `service-sheet-cutting-${nesting.byMaterial[0]!.materialId}`
    const p = priceProject(panels, nesting, shop, [], [], { lineDiscounts: { [`services:${id}`]: { kind: 'percent', value: 50 } } })
    expect(p.services.find((l) => l.id === id)!.discountAmount).toBe(nesting.byMaterial[0]!.sheets.length * rates.cutting / 2)
  })

  it('профиль баптауды сақтайды, бүтін емес мөлшерлеме — қате', () => {
    const saved = parseShopProfile(JSON.parse(JSON.stringify(shop)))
    expect(saved.sheetServices).toEqual({ enabled: true, rates })
    expect(parseShopProfile(JSON.parse(JSON.stringify(base))).sheetServices).toBeUndefined()
    expect(() => parseShopProfile({ ...shop, sheetServices: { enabled: true, rates: { ...rates, cutting: 1.5 } } })).toThrow()
  })
})

describe('қаржы кестесінің жиыны', () => {
  it('материал + кромка + фурнитура + қызметтер = goods + servicesTotal', () => {
    const shop: ShopProfile = { ...pricedShop, sheetServices: { enabled: true, rates: { cutting: 50000, drilling: 0, edging: 700 } } }
    for (const template of SEED_TEMPLATES.slice(0, 12)) {
      const built = build(templateToCabinet(template, catalog))
      const p = priceProject(built.panels, built.nesting, shop, [], [template.width])
      const totals = financeTotals(p)
      expect(totals.goodsAndServices, template.id).toBe(p.goods + p.servicesTotal)
      expect(totals.sheets).toBe(built.nesting.byMaterial.reduce((sum, g) => sum + g.sheets.length, 0))
      expect(totals.installationCost).toBe(p.installation.cost)
      expect(totals.edgeMetres).toBeGreaterThan(0)
    }
  })
})

describe('қолмен сату бағасы ЛДСП ауданына пропорционал', () => {
  const wide = build({ ...penal, width: penal.width + 150 })

  it('ауданға ХДФ артқы қабырға кірмейді', () => {
    const ids = defaultScalingMaterialIds(panels, pricedShop)
    const backIds = new Set(panels.filter((p) => p.role === 'back').map((p) => p.materialId))
    for (const id of ids) {
      expect(panels.some((p) => p.materialId === id && p.role !== 'back')).toBe(true)
    }
    expect(ids.some((id) => backIds.has(id) && panels.every((p) => p.materialId !== id || p.role === 'back'))).toBe(false)
  })

  it('өлшем өзгермесе — баға ДӘЛ сол тиын', () => {
    const scaling = captureSalePriceScaling(panels, pricedShop)
    const p = priceProject(panels, nesting, pricedShop, [], [], { salePrice: 45_000_050, salePriceScaling: scaling })
    expect(p.grossTotal).toBe(45_000_050)
    expect(p.salePriceScaling).toEqual({ savedSalePrice: 45_000_050, baseAreaMm2: scaling.baseAreaMm2, currentAreaMm2: scaling.baseAreaMm2 })
  })

  it('кеңейсе — баға аудан қатынасымен өседі, бүтін теңгеге дөңгелектеледі', () => {
    const scaling = captureSalePriceScaling(panels, pricedShop)
    const current = scalingAreaMm2(wide.panels, scaling.materialIds)
    expect(current).toBeGreaterThan(scaling.baseAreaMm2)
    const p = priceProject(wide.panels, wide.nesting, pricedShop, [], [], { salePrice: 45_000_000, salePriceScaling: scaling })
    const exact = 45_000_000 * current / scaling.baseAreaMm2
    expect(p.grossTotal % 100).toBe(0)
    expect(Math.abs(p.grossTotal - exact)).toBeLessThanOrEqual(50)
    expect(p.salePriceOverride).toBe(p.grossTotal)
    expect(p.total).toBe(p.grossTotal)
    // Масштабсыз — қолмен баға тұрақты.
    expect(priceProject(wide.panels, wide.nesting, pricedShop, [], [], { salePrice: 45_000_000 }).grossTotal).toBe(45_000_000)
  })

  it('дөңгелектеу ережесі: жақын теңге, дәл жартысы жоғары', () => {
    expect(scaleSalePrice(100_000, 2, 3)).toBe(150_000)
    // 1 050 тиын × 1/2 = 525 тиын = 5,25 ₸ → 5 ₸.
    expect(scaleSalePrice(1_050, 2, 1)).toBe(500)
    // 1 100 × 1/2 = 550 тиын = 5,50 ₸ → 6 ₸ (жартысы жоғары).
    expect(scaleSalePrice(1_100, 2, 1)).toBe(600)
    expect(scaleSalePrice(1_099, 2, 1)).toBe(500)
    expect(scaleSalePrice(123_457, 7, 7)).toBe(123_457)
  })

  it('жарамсыз база өріс атымен қате береді', () => {
    const error = (() => { try { scaleSalePrice(1000, 0, 5) } catch (cause) { return cause } })()
    expect(error).toBeInstanceOf(ConfigValidationError)
    expect((error as ConfigValidationError).field).toBe('priceOverrides.salePriceScaling.baseAreaMm2')
    expect(() => captureSalePriceScaling(panels, pricedShop, [])).toThrow(ConfigValidationError)
  })

  it('жоба файлы масштаб пен «Орнатусыз» белгісін сақтайды', () => {
    const raw = JSON.parse(JSON.stringify(referenceProject))
    raw.priceOverrides = { salePrice: 100, withoutInstallation: true, salePriceScaling: { baseAreaMm2: 10, materialIds: ['m'] } }
    expect(parseProject(raw).priceOverrides).toEqual(raw.priceOverrides)
  })
})
