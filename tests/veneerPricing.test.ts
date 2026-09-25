import { describe, expect, it } from 'vitest'
import { cutPlan } from '../src/core/cutPlan'
import { generateCabinet } from '../src/core/generateCabinet'
import { nestPanels } from '../src/core/nesting'
import { priceProject } from '../src/core/pricing'
import { defaultShopProfile } from '../src/core/shop'
import { findTemplate, templateToCabinet } from '../src/core/templates'

const shop = defaultShopProfile()
const sourceCatalog = { materials: shop.materials, edgeBands: shop.edgeBands }
const source = generateCabinet(
  templateToCabinet(findTemplate('wardrobe-penal-600')!, sourceCatalog),
  sourceCatalog,
)[0]!
const material = { ...shop.materials.find((m) => m.id === source.materialId)!, sheetWidth: 1000, sheetHeight: 700, trimEdge: 0, pricePerSheet: 10_000, hasGrain: false }
const catalog = { materials: [material], edgeBands: shop.edgeBands }
const pricedShop = { ...shop, materials: [material] }
const part = (id: string, veneerGroup?: string) => ({
  ...source,
  id,
  cutLength: 400,
  cutWidth: 300,
  finishedLength: 400,
  finishedWidth: 300,
  ...(veneerGroup ? { veneerGroup } : {}),
})

describe('нақты парақ шығыны', () => {
  it('смета раскройдағы нақты парақ санын алады, 20% аудан қорын қоспайды', () => {
    const panels = Array.from({ length: 9 }, (_, i) => part(`part-${i}`))
    const nesting = nestPanels(panels, catalog)
    const plan = cutPlan(nesting)
    const price = priceProject(panels, nesting, pricedShop)

    expect(nesting.unplaced).toEqual([])
    // 9 × 400 × 300 мм = 1.08 м², яғни ауданы бойынша екі парақ жететіндей.
    // Гильотин раскройда 1000 × 700 мм параққа төртеуі ғана сыйып, үшеуі кетеді.
    expect(nesting.sheetCount).toBe(3)
    expect(plan.byMaterial[0]?.sheets).toHaveLength(nesting.byMaterial[0]!.sheets.length)
    expect(price.byMaterial[0]?.sheets).toBe(nesting.byMaterial[0]?.sheets.length)
    expect(price.materials[0]?.qty).toBe(nesting.byMaterial[0]?.sheets.length)
    expect(price.materials[0]?.cost).toBe(price.materials[0]!.qty * material.pricePerSheet)
  })

  it('сыймаған деталь барда толық емес парақ санымен смета жасамайды', () => {
    const panels = [part('fits'), { ...part('oversize'), cutLength: 1100, finishedLength: 1100 }]
    const nesting = nestPanels(panels, catalog)
    expect(nesting.unplaced.map((p) => p.panelId)).toEqual(['oversize'])
    expect(() => priceProject(panels, nesting, pricedShop)).toThrow(/nesting\.unplaced|oversize/)
  })
})

describe('шпон өрнегінің раскрой тобы', () => {
  it('бос топ атауын қабылдамайды', () => {
    expect(() => nestPanels([part('a', '  ')], catalog)).toThrow(/veneerGroup/)
  })

  it('әр түрлі топтарды бөлек парақтарға салады және топты параққа жазады', () => {
    const result = nestPanels([part('a', 'fronts-a'), part('b', 'fronts-b')], catalog)
    expect(result.unplaced).toEqual([])
    expect(result.sheetCount).toBe(2)
    expect(result.byMaterial[0]?.sheets.map((s) => s.veneerGroup)).toEqual(['fronts-a', 'fronts-b'])
    expect(result.byMaterial[0]?.sheets.map((s) => s.parts.map((p) => p.panelId))).toEqual([['a'], ['b']])
  })

  it('топтағы детальдарды бір парақта ұстап, декор бағытын бұзбайды', () => {
    const panels = [part('a', 'fronts'), part('b', 'fronts')].map((p) => ({ ...p, grainAlongLength: false }))
    const result = nestPanels(panels, catalog)
    expect(result.sheetCount).toBe(1)
    expect(result.byMaterial[0]?.sheets[0]?.parts).toHaveLength(2)
    expect(result.byMaterial[0]?.sheets[0]?.parts.map((p) => p.rotated)).toEqual([true, true])
  })
})
