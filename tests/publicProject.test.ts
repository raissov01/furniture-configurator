import { describe, expect, it } from 'vitest'
import { defaultShopProfile } from '../src/core/shop'
import { toPublicProject, toProductionProject } from '../src/core/publicProject'
import type { ProjectFile } from '../src/core/types'

const project = (): ProjectFile => ({
  schemaVersion: 3, name: 'Үлгі', cabinets: [], placements: [],
  room: { width: 5000, depth: 5000, height: 3000 },
  materials: [{ ...defaultShopProfile().materials[0]!, pricePerSheet: 123456, slab: { stockLengths: [3050], pricePerMeter: 7890 } }],
  edgeBands: [{ ...defaultShopProfile().edgeBands[0]!, pricePerMeter: 1234 }],
  priceOverrides: { coefficient: 1.7, salePrice: 25000000 },
})

describe('клиент payload-ы', () => {
  it('hash/API ішінде шығын, коэффициент, markup жоқ; тек қол бағасы бар', () => {
    const publicProject = toPublicProject(project())
    const raw = JSON.stringify(publicProject)
    expect(publicProject.priceOverrides).toEqual({ salePrice: 25000000 })
    expect(raw).not.toContain('123456')
    expect(raw).not.toContain('7890')
    expect(raw).not.toContain('1234')
    expect(raw).not.toContain('coefficient')
    expect(publicProject.edgeBands[0]?.pricePerMeter).toBe(0)
    expect(raw).not.toContain('info')
    expect(toProductionProject(project()).priceOverrides).toBeUndefined()
  })
})
