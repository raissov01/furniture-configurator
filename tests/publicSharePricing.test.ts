import { describe, expect, it } from 'vitest'
import { findTemplate, parseProjectV4, templateToCabinet } from '../src/core/index'
import { toPricedPublicProject } from '../src/core/publicProject'
import { defaultShopProfile } from '../src/core/shop'

const shop = (() => {
  const base = defaultShopProfile()
  return {
    ...base,
    materials: base.materials.map((material) => ({ ...material, pricePerSheet: 100_000 })),
    edgeBands: base.edgeBands.map((band) => ({ ...band, pricePerMeter: 1_000 })),
    hardware: base.hardware.map((item) => ({ ...item, pricePerUnit: 1_000 })),
  }
})()

const project = () => {
  const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, {
    materials: shop.materials, edgeBands: shop.edgeBands,
  })
  return parseProjectV4({
    schemaVersion: 3, name: 'Жеңілдік', cabinets: [cabinet],
    placements: [{ cabinetId: cabinet.id, wall: 'south', offset: 0 }],
    room: { width: 4000, depth: 3000, height: 2700 },
    materials: shop.materials, edgeBands: shop.edgeBands,
    priceOverrides: {
      salePrice: 13_000_050,
      lineDiscounts: { [`materials:${cabinet.carcassMaterialId}`]: { kind: 'amount', value: 10_000 } },
    },
  })
}

describe('жеңілдікпен бөлісілген жобаның бағасы', () => {
  it('клиентке КП-дағы соңғы соманы дәл тиынмен береді, шығынды жасырған күйде', () => {
    const publicProject = toPricedPublicProject(project(), shop)
    expect(publicProject.priceOverrides).toEqual({ salePrice: 12_990_050 })
    const json = JSON.stringify(publicProject)
    expect(json).not.toContain('lineDiscounts')
    expect(json).not.toContain('100000')
    expect(publicProject.materials.every((material) => material.pricePerSheet === 0)).toBe(true)
  })
})
