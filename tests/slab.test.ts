/**
 * ТАҚТА (постформинг столешница) — парақ емес (пайдаланушы, 09-13).
 *
 * Тексерілетіні: тақта раскройға КІРМЕЙДІ, «параққа сыймайды» деп
 * ескертпейді, ал сметаға МЕТРМЕН түседі (бағасы жоқ болса — ескерту).
 */
import { describe, expect, it } from 'vitest'
import {
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  nestPanels,
  panelFitWarnings,
  parseShopProfile,
  priceProject,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, ShopProfile } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = { materials: shop.materials, edgeBands: shop.edgeBands }
const SLAB = 'pf38-stone'

/** Ас үй тумбасы, үстінде постформинг столешница. */
const base: CabinetConfig = {
  ...templateToCabinet(findTemplate('kitchen-base-full-600')!, catalog),
  width: 1200,
  worktop: { materialId: SLAB, overhangFront: 30, overhangSides: 0 },
}
const panels = generateCabinet(base, catalog)
const worktop = panels.find((p) => p.id === 'worktop')!

describe('тақта (постформинг столешница)', () => {
  it('әдепкі цехта постформинг бар: 38 мм, 3050/4100', () => {
    const m = shop.materials.find((x) => x.id === SLAB)!
    expect(m.thickness).toBe(38)
    expect(m.slab?.stockLengths).toEqual([3050, 4100])
  })

  it('схема тақтаны қабылдайды, өрісі жоғалмайды', () => {
    const parsed = parseShopProfile(JSON.parse(JSON.stringify(shop)))
    expect(parsed.materials.find((x) => x.id === SLAB)?.slab?.stockLengths).toEqual([3050, 4100])
  })

  it('раскройға кірмейді, ал корпус бұрынғыдай раскройда', () => {
    expect(worktop.materialId).toBe(SLAB)
    const nesting = nestPanels(panels, catalog)
    expect(nesting.byMaterial.some((g) => g.materialId === SLAB)).toBe(false)
    expect(nesting.unplaced.some((u) => JSON.stringify(u).includes(SLAB))).toBe(false)
    expect(nesting.byMaterial.length).toBeGreaterThan(0)
  })

  it('ұзын тақта «параққа сыймайды» деп ескертпейді (ЛДСП-дағы сол деталь — ескертеді)', () => {
    const long = { ...worktop, finishedLength: 3386, cutLength: 3386 }
    expect(panelFitWarnings([long], catalog)).toEqual([])
    const asSheet = { ...long, materialId: base.carcassMaterialId }
    expect(panelFitWarnings([asSheet], catalog)).toHaveLength(1)
  })

  it('сметаға метрмен түседі; бағасы жоқ болса — ескерту', () => {
    const nesting = nestPanels(panels, catalog)
    const unpriced = priceProject(panels, nesting, shop)
    expect(unpriced.missingPrices.some((m) => m.includes('цена за метр') && m.includes('постформинг'))).toBe(true)

    const priced: ShopProfile = {
      ...shop,
      materials: shop.materials.map((m) => (m.slab ? { ...m, slab: { ...m.slab, pricePerMeter: 1_200_000 } } : m)),
    }
    const breakdown = priceProject(panels, nesting, priced)
    const line = breakdown.materials.find((l) => l.id === SLAB)!
    expect(line.unit).toBe('м')
    expect(line.qty).toBe(1.2)
    expect(line.cost).toBe(1_440_000)
    expect(breakdown.missingPrices.some((m) => m.includes('постформинг'))).toBe(false)
  })
})
