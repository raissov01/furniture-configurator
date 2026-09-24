import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError, defaultShopProfile, findTemplate, formatTengeExact, generateCabinet,
  nestPanels, parseProject, priceProject, quoteLineGroups, quoteTotalsView, templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'
import { referenceProject } from './fixtures'

const base = defaultShopProfile()
const catalog = { materials: base.materials, edgeBands: base.edgeBands }
const panels = generateCabinet(templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog), catalog)
const nesting = nestPanels(panels, catalog)
const shop: ShopProfile = {
  ...base,
  materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
  edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
  markupPercent: 20,
  coefficient: 2,
}

describe('жолдық және жалпы жеңілдік', () => {
  it('тиын қалдығын смета мен КП-да жоғалтпай көрсетеді', () => {
    expect(formatTengeExact(12345)).toBe('123,45 ₸')
    expect(formatTengeExact(100)).toBe('1 ₸')
    expect(formatTengeExact(0, 'тг')).toBe('0 тг')
  })

  it('ондық пайыздағы дәл жарты тиынды жоғары дөңгелектейді', () => {
    const p = priceProject(panels, nesting, shop, [], [], {
      salePrice: 5000, overallDiscount: { kind: 'percent', value: 0.57 },
    })
    expect(p.overallDiscountAmount).toBe(29) // 5000 × 0.57% = 28.5 тиын
    expect(p.total).toBe(4971)
    const second = priceProject(panels, nesting, shop, [], [], {
      salePrice: 5500, overallDiscount: { kind: 'percent', value: 0.7 },
    })
    expect(second.overallDiscountAmount).toBe(39) // 38.5 тиын
  })
  it('жолдық %-ды тиынға бір рет дөңгелектеп, жалпы жеңілдікті қалған сомадан есептейді', () => {
    const plain = priceProject(panels, nesting, shop)
    const line = plain.materials[0]!
    const p = priceProject(panels, nesting, shop, [], [], {
      lineDiscounts: { [`materials:${line.id}`]: { kind: 'percent', value: 12.34567 } },
      overallDiscount: { kind: 'percent', value: 10 },
    })
    const lineAmount = Math.round(line.cost * 0.1234567)
    const overallAmount = Math.round((plain.calculatedTotal - lineAmount) * 0.1)
    expect(p.materials[0]?.discountAmount).toBe(lineAmount)
    expect(p.lineDiscountTotal).toBe(lineAmount)
    expect(p.overallDiscountAmount).toBe(overallAmount)
    expect(p.grossTotal).toBe(plain.calculatedTotal)
    expect(p.total).toBe(plain.calculatedTotal - lineAmount - overallAmount)
    expect(p.discountTotal).toBe(lineAmount + overallAmount)
  })

  it('сома жеңілдігі әр жолда және жалпы есепте тура тиынмен жүреді', () => {
    const plain = priceProject(panels, nesting, shop)
    const line = plain.materials[0]!
    const p = priceProject(panels, nesting, shop, [], [], {
      lineDiscounts: { [`materials:${line.id}`]: { kind: 'amount', value: 12345 } },
      overallDiscount: { kind: 'amount', value: 6789 },
    })
    expect(p.materials[0]?.discountAmount).toBe(12345)
    expect(p.overallDiscountAmount).toBe(6789)
    expect(p.total).toBe(plain.total - 19134)
  })

  it('қолмен сату бағасы жеңілдікке дейінгі ВСЕГО; цех жіктемесі клиент көрінісіне шықпайды', () => {
    const plain = priceProject(panels, nesting, shop)
    const line = plain.materials[0]!
    const p = priceProject(panels, nesting, shop, [], [], {
      salePrice: 5_000_000,
      lineDiscounts: { [`materials:${line.id}`]: { kind: 'amount', value: 100_000 } },
      overallDiscount: { kind: 'percent', value: 10 },
    })
    expect(p.calculatedTotal).toBe(plain.calculatedTotal)
    expect(p.grossTotal).toBe(5_000_000)
    expect(p.overallDiscountAmount).toBe(490_000)
    expect(p.total).toBe(4_410_000)
    expect(quoteTotalsView(p)).toEqual({ kind: 'finalOnly', grossTotal: 5_000_000, discount: 590_000, total: 4_410_000 })
    expect(quoteLineGroups(p)).toEqual([])
  })

  it('қалыпты КП-да позициялар мен олардың жеңілдіктері көрінеді', () => {
    const p = priceProject(panels, nesting, shop, [], [], { overallDiscount: { kind: 'percent', value: 5 } })
    const groups = quoteLineGroups(p)
    expect(groups.flatMap((group) => group.lines)).toHaveLength(
      p.materials.length + p.edges.length + p.hardware.length + p.services.length,
    )
  })

  it('жарамсыз жеңілдіктерді атауы мен аралығын көрсетіп қайтарады', () => {
    const id = priceProject(panels, nesting, shop).materials[0]!.id
    const invalid = [
      [{ overallDiscount: { kind: 'percent', value: 101 } }, 'priceOverrides.overallDiscount', '0..100'],
      [{ overallDiscount: { kind: 'amount', value: -1 } }, 'priceOverrides.overallDiscount', '≥ 0'],
      [{ lineDiscounts: { [`materials:${id}`]: { kind: 'amount', value: 1.5 } } }, `priceOverrides.lineDiscounts.materials:${id}`, 'бүтін тиын'],
      [{ lineDiscounts: { 'materials:missing': { kind: 'percent', value: 1 } } }, 'priceOverrides.lineDiscounts.materials:missing', 'бар позиция'],
    ] as const
    for (const [override, field, allowed] of invalid) {
      try {
        priceProject(panels, nesting, shop, [], [], override)
        throw new Error('Күтілген ConfigValidationError болмады')
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError)
        expect((error as ConfigValidationError).field).toBe(field)
        expect((error as ConfigValidationError).allowed).toContain(allowed)
      }
    }
  })

  it('жолдық сома жол құнынан, жалпы сома қалған бағадан аса алмайды', () => {
    const line = priceProject(panels, nesting, shop).materials[0]!
    expect(() => priceProject(panels, nesting, shop, [], [], {
      lineDiscounts: { [`materials:${line.id}`]: { kind: 'amount', value: line.cost + 1 } },
    })).toThrow(ConfigValidationError)
    expect(() => priceProject(panels, nesting, shop, [], [], {
      salePrice: 100, overallDiscount: { kind: 'amount', value: 101 },
    })).toThrow(ConfigValidationError)
  })

  it('жеңілдіктер жоба файлында сақталады, ескі файл өзгертусіз ашылады', () => {
    expect(parseProject(referenceProject).priceOverrides).toBeUndefined()
    const discounts = {
      lineDiscounts: { 'materials:ldsp-white': { kind: 'percent', value: 5 } },
      overallDiscount: { kind: 'amount', value: 25000 },
    }
    expect(parseProject({ ...referenceProject, priceOverrides: discounts }).priceOverrides).toEqual(discounts)
  })

  it('жоба схемасы жарамсыз пайыз бен тиынды қабылдамайды', () => {
    for (const discount of [
      { kind: 'percent', value: 101 },
      { kind: 'percent', value: -1 },
      { kind: 'amount', value: 1.5 },
      { kind: 'amount', value: -1 },
      { kind: 'amount', value: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expect(() => parseProject({ ...referenceProject, priceOverrides: { overallDiscount: discount } })).toThrow()
    }
  })

  it('unsafe manual сату бағасын path/range қатесімен қабылдамайды', () => {
    try {
      priceProject(panels, nesting, shop, [], [], { salePrice: Number.MAX_SAFE_INTEGER + 1 })
      throw new Error('Күтілген ConfigValidationError болмады')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError)
      expect((error as ConfigValidationError).field).toBe('priceOverrides.salePrice')
      expect((error as ConfigValidationError).allowed).toContain('бүтін тиын')
    }
  })
})
