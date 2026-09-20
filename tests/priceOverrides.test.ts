/**
 * Баға түзетулері (qdesign паритеті: `docs/pro100/parity.md` — қараңыз
 * есеп, `.superpowers/sdd/2026-09-20-free-form-editor-phase1/pro100-p2-report.md`).
 *
 * qdesign-дың моделі скидка ЕМЕС, коэффициент:
 *   Өзіндік құн (goods + services) × коэффициент = Алдын ала сату бағасы
 *   → «Сату бағасы» қолмен қайта жазылуы мүмкін (үстінен басады).
 *
 * ДИЗАЙН ШЕШІМІ:
 *   - Коэффициент ЖОБА деңгейінде `ShopProfile.coefficient`-ті алмастырады.
 *     Жарамсыз (≤0) болса — цех профиліндегідей үнсіз 1-ге ТЕҢЕЛМЕЙДІ,
 *     `ConfigValidationError` лақтырады: бұл жобаға арнайы қолмен қойылған
 *     сан, қате өтіп кетпеуі керек.
 *   - «Сату бағасы» (`salePrice`) берілсе, `PriceBreakdown.total`-ды БАСЫП
 *     ЖАЗАДЫ, бірақ коэффициенттен шыққан сома (`calculatedTotal`) да
 *     сақталады — шебер кез келген сәтте override-ты алып тастап,
 *     коэффициентке қайта орала алады.
 *   - Клиентке шығатын КП-да (`quotePdf.ts`) override белсенді болғанда
 *     себестоимость/коэффициент/наценка КӨРІНБЕЙДІ — тек соңғы баға
 *     (`quoteTotalsView`, төменде тексеріледі).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError, defaultShopProfile, findTemplate, generateCabinet, nestPanels,
  parseProject, priceProject, quotePdf, quoteTotalsView, templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'
import { referenceProject } from './fixtures'

const font = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))
const fonts = { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') }

const base = defaultShopProfile()
const catalog = { materials: base.materials, edgeBands: base.edgeBands }
const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
const panels = generateCabinet(cabinet, catalog)
const nesting = nestPanels(panels, catalog)

/** Бағасы толтырылған цех — pricing.test.ts-тегі эталонмен бірдей, коэффициент ×2. */
const pricedShop: ShopProfile = {
  ...base,
  materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
  edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
  labour: { perSquareMetre: 150000, perHole: 3000, perEdgeMetre: 5000 },
  markupPercent: 20,
  coefficient: 2,
}

describe('overrides жоқта — бұрынғыдай (кері үйлесімділік)', () => {
  it('calculatedTotal === total, salePriceOverride жоқ', () => {
    const p = priceProject(panels, nesting, pricedShop)
    expect(p.calculatedTotal).toBe(p.total)
    expect(p.salePriceOverride).toBeUndefined()
    expect(p.coefficient).toBe(2)
  })
})

describe('жоба коэффициенті — ShopProfile.coefficient-ті алмастырады', () => {
  it('effective коэффициент overrides-тен алынады', () => {
    const withShopCoef = priceProject(panels, nesting, pricedShop)
    const withOverride = priceProject(panels, nesting, pricedShop, [], [], { coefficient: 3 })
    expect(withOverride.coefficient).toBe(3)
    expect(withOverride.coefficient).not.toBe(withShopCoef.coefficient)
  })

  it('дөңгелектеу ережесі сақталады — coefficientAmount бүтін теңгеге', () => {
    const p = priceProject(panels, nesting, pricedShop, [], [], { coefficient: 2.7 })
    expect(p.coefficientAmount % 100).toBe(0)
    const base2 = p.goods + p.servicesTotal
    expect(p.coefficientAmount).toBe(Math.round((base2 * (2.7 - 1)) / 100) * 100)
  })

  it('теріс коэффициент — ConfigValidationError (цех профиліндегідей үнсіз 1-ге теңелмейді)', () => {
    expect(() => priceProject(panels, nesting, pricedShop, [], [], { coefficient: -1 }))
      .toThrow(ConfigValidationError)
  })

  it('нөл коэффициент — ConfigValidationError', () => {
    expect(() => priceProject(panels, nesting, pricedShop, [], [], { coefficient: 0 }))
      .toThrow(ConfigValidationError)
  })
})

describe('сату бағасы — қолмен басып жазу', () => {
  it('total = salePrice, calculatedTotal коэффициенттен шыққан күйінде қалады', () => {
    const plain = priceProject(panels, nesting, pricedShop)
    const overridden = priceProject(panels, nesting, pricedShop, [], [], { salePrice: 5_000_000 })
    expect(overridden.total).toBe(5_000_000)
    expect(overridden.calculatedTotal).toBe(plain.calculatedTotal)
    expect(overridden.salePriceOverride).toBe(5_000_000)
    // coefficientAmount/subtotal/markup — коэффициенттен шыққан сандар, override оларға тимейді.
    expect(overridden.subtotal).toBe(plain.subtotal)
    expect(overridden.markup).toBe(plain.markup)
  })

  it('теріс сату бағасы — ConfigValidationError', () => {
    expect(() => priceProject(panels, nesting, pricedShop, [], [], { salePrice: -1 }))
      .toThrow(ConfigValidationError)
  })

  it('бүтін емес (тиын емес) сату бағасы — ConfigValidationError', () => {
    expect(() => priceProject(panels, nesting, pricedShop, [], [], { salePrice: 100.5 }))
      .toThrow(ConfigValidationError)
  })

  it('коэффициент пен сату бағасы бірге беріле алады', () => {
    const p = priceProject(panels, nesting, pricedShop, [], [], { coefficient: 3, salePrice: 9_000_000 })
    expect(p.coefficient).toBe(3)
    expect(p.total).toBe(9_000_000)
  })
})

describe('parseProject — priceOverrides ЕРІКТІ, schemaVersion өзгермейді', () => {
  it('ескі жоба (override-сыз) бұрынғыдай ашылады', () => {
    const raw = JSON.parse(JSON.stringify(referenceProject))
    expect(raw.priceOverrides).toBeUndefined()
    const parsed = parseProject(raw)
    expect(parsed.schemaVersion).toBe(3)
    expect(parsed.priceOverrides).toBeUndefined()
  })

  it('priceOverrides берілсе round-trip арқылы сақталады', () => {
    const withOverrides = { ...referenceProject, priceOverrides: { coefficient: 2.5, salePrice: 3_000_000 } }
    const parsed = parseProject(JSON.parse(JSON.stringify(withOverrides)))
    expect(parsed.priceOverrides).toEqual({ coefficient: 2.5, salePrice: 3_000_000 })
    expect(parsed.schemaVersion).toBe(3)
  })

  it('жарым-жартылай (тек коэффициент) те дұрыс өтеді', () => {
    const withOverrides = { ...referenceProject, priceOverrides: { coefficient: 4 } }
    const parsed = parseProject(JSON.parse(JSON.stringify(withOverrides)))
    expect(parsed.priceOverrides).toEqual({ coefficient: 4 })
  })
})

describe('quoteTotalsView — КП-да не көрінетінін анықтайды (клиентке өзіндік құн/коэффициент жоқ)', () => {
  it('override жоқта — толық жіктеме (себестоимость, наценка, итого)', () => {
    const p = priceProject(panels, nesting, pricedShop)
    const view = quoteTotalsView(p)
    expect(view.kind).toBe('breakdown')
    if (view.kind === 'breakdown') {
      expect(view.subtotal).toBe(p.subtotal)
      expect(view.markup).toBe(p.markup)
      expect(view.total).toBe(p.total)
    }
  })

  it('сату бағасы басып жазылса — тек соңғы баға, себестоимость жоқ', () => {
    const p = priceProject(panels, nesting, pricedShop, [], [], { salePrice: 5_000_000 })
    const view = quoteTotalsView(p)
    expect(view.kind).toBe('finalOnly')
    if (view.kind === 'finalOnly') expect(view.total).toBe(5_000_000)
  })

  it('тек коэффициент override (сату бағасынсыз) — жіктеме сақталады, себестоимость=коэффициенттен шыққан сомамен келіседі', () => {
    const p = priceProject(panels, nesting, pricedShop, [], [], { coefficient: 5 })
    const view = quoteTotalsView(p)
    expect(view.kind).toBe('breakdown')
  })
})

describe('quotePdf — override болғанда себестоимость/наценка жасырылады', () => {
  it('override жоқта құжат бұрынғыдай (өзгеріссіз) шығады', async () => {
    const p = priceProject(panels, nesting, pricedShop)
    const bytes = await quotePdf({ price: p, shop: pricedShop, projectName: 'Шкаф', date: '20.09.2026', fonts })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('сату бағасы override-і бар КП-дан кем дегенде бір бет шығады', async () => {
    const p = priceProject(panels, nesting, pricedShop, [], [], { salePrice: 5_000_000 })
    const bytes = await quotePdf({ price: p, shop: pricedShop, projectName: 'Шкаф', date: '20.09.2026', fonts })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })
})
