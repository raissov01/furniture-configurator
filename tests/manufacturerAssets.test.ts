import { describe, expect, it } from 'vitest'
import {
  OWN_CATALOG, ownCatalogBuild, resolveTextureSource, validateTextureGrants,
  ManufacturerModelSourceSchema, parseProjectV4, migrateV3ToV4, SEED_CATALOG,
} from '../src/core/index'
import type { ProjectFile, TextureGrant } from '../src/core/index'

const licensed: TextureGrant = {
  manufacturer: 'Egger', decorCode: 'H1145', structureCode: 'ST10',
  imageUrl: 'https://www.egger.com/assets/H1145-ST10.jpg',
  licenseUrl: 'https://www.egger.com/terms/saas-license',
  licenseId: 'signed-saas-grant-1', attribution: '© EGGER · H1145 ST10',
  permission: 'saas-display',
}

describe('өндіруші активінің лицензиясы', () => {
  it('код пен құрылым бойынша тек расталған грант сурет URL-ін ашады', () => {
    expect(resolveTextureSource('Egger', 'H1145', 'ST10', 'https://www.egger.com/h1145', [licensed]))
      .toMatchObject({ kind: 'licensed-image', imageUrl: licensed.imageUrl, licenseId: licensed.licenseId,
        attribution: licensed.attribution })
    expect(resolveTextureSource('Egger', 'H1145', 'ST12', 'https://www.egger.com/h1145', [licensed]))
      .toEqual({ kind: 'manufacturer-page', pageUrl: 'https://www.egger.com/h1145', licenseStatus: 'unverified' })
  })

  it('лицензия не атрибуция жоқ сурет URL-ін қабылдамайды', () => {
    expect(validateTextureGrants([{ ...licensed, licenseId: '' }])).not.toEqual([])
    expect(validateTextureGrants([{ ...licensed, attribution: '' }])).not.toEqual([])
    expect(validateTextureGrants([{ ...licensed, imageUrl: 'javascript:alert(1)' }])).not.toEqual([])
    expect(validateTextureGrants([{ ...licensed, permission: 'unknown' }])).not.toEqual([])
    expect(validateTextureGrants([licensed, licensed])).not.toEqual([])
    expect(() => resolveTextureSource('Egger', 'H1145', 'ST10', 'https://www.egger.com/h1145',
      [{ ...licensed, licenseId: '' }])).toThrow(/лицензиясы жарамсыз/)
    expect(resolveTextureSource('Бейтаныс', 'A1', null, 'https://example.com/a1'))
      .toEqual({ kind: 'none' })
  })

  it('өз каталогындағы әр материалдың текстура көзі анық, лицензиясыз сурет URL-і жоқ', () => {
    const { materialMeta } = ownCatalogBuild()
    expect(Object.keys(materialMeta)).toHaveLength(OWN_CATALOG.materials.length)
    for (const material of OWN_CATALOG.materials) {
      const source = materialMeta[material.id]?.textureSource
      expect(source, material.id).toBeDefined()
      if (source?.kind === 'manufacturer-page') {
        expect(source.pageUrl).toMatch(/^https:\/\//)
        expect(source).not.toHaveProperty('imageUrl')
      } else if (source?.kind === 'licensed-image') {
        expect(source.licenseUrl).toMatch(/^https:\/\//)
        expect(source.attribution.trim()).not.toBe('')
      } else expect(source).toEqual({ kind: 'none' })
    }
  })

  it('фурнитура моделінің өндіруші беті solid түйінмен сақталады', () => {
    const modelSource = ManufacturerModelSourceSchema.parse({
      kind: 'manufacturer-page', manufacturer: 'Blum', article: '71B3550',
      pageUrl: 'https://www.blum.com/in/en/services/planning-construction-product-selection/product-database/',
      licenseStatus: 'unverified',
    })
    const legacy: ProjectFile = {
      schemaVersion: 3, name: 'Сынақ', materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands, cabinets: [], placements: [],
      room: { width: 4000, depth: 3000, height: 2700 },
    }
    const file = migrateV3ToV4(legacy)
    file.root.children.push({ kind: 'solid', id: 'hinge', name: 'Ілмек',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      solid: { size: { x: 30, y: 20, z: 15 }, modelSource },
    })
    expect(parseProjectV4(JSON.parse(JSON.stringify(file))).root.children.at(-1))
      .toEqual(file.root.children.at(-1))
    expect(() => ManufacturerModelSourceSchema.parse({ ...modelSource,
      imageUrl: 'https://www.blum.com/unlicensed.glb' })).toThrow()
    expect(() => ManufacturerModelSourceSchema.parse({ kind: 'licensed-model',
      manufacturer: 'Blum', article: '71B3550', modelUrl: 'https://www.blum.com/hinge.glb',
      format: 'glb', attribution: '© Blum', permission: 'saas-display' })).toThrow()
  })
})
