import { describe, expect, it } from 'vitest'
import { filterOwnMaterials, ownMaterialOptions } from '../lib/ownCatalogUi'
import type { Material } from '../src/core/types'
import type { OwnMaterialMeta } from '../src/core/data/catalog/schema'

const materials = [
  { id: 'egger-h1145-16', name: 'Дуб Бардолино', thickness: 16, sheetWidth: 2800, sheetHeight: 2070, hasGrain: true, pricePerSheet: 0, trimEdge: 10 },
  { id: 'egger-h1145-18', name: 'Дуб Бардолино', thickness: 18, sheetWidth: 2800, sheetHeight: 2070, hasGrain: true, pricePerSheet: 0, trimEdge: 10 },
  { id: 'lamarty-0101-16', name: 'Белый', thickness: 16, sheetWidth: 2750, sheetHeight: 1830, hasGrain: false, pricePerSheet: 0, trimEdge: 10 },
] satisfies Material[]

const base: OwnMaterialMeta = {
  manufacturer: 'Egger', kind: 'ldsp', decorCode: 'H1145', structureCode: 'ST10', productLine: null,
  decorName: 'Дуб Бардолино', collection: 'Woodgrain', publishedThicknessesMm: [16, 18],
  grain: 'wood', grainBasis: 'official', sizeBasis: 'range-wide', sizeSourceUrl: 'https://example.com/size',
  sourceId: 'egger', sourceUrl: 'https://example.com/decor', dateSeen: '2026-09-26', textureSource: { kind: 'none' },
}
const meta: Record<string, OwnMaterialMeta> = {
  'egger-h1145-16': base,
  'egger-h1145-18': base,
  'lamarty-0101-16': { ...base, manufacturer: 'Lamarty', decorCode: '0101', collection: null, decorName: 'Белый' },
}

describe('own catalogue selection', () => {
  it('exposes producer and collection options without inventing missing collections', () => {
    expect(ownMaterialOptions(materials, meta)).toEqual({ manufacturers: ['Egger', 'Lamarty'], collections: ['Woodgrain'] })
  })

  it('combines producer, collection and decor code filters, preserving distinct thicknesses', () => {
    expect(filterOwnMaterials(materials, meta, { manufacturer: 'Egger', collection: 'Woodgrain', decorCode: 'h-1145' })
      .map((material) => material.id)).toEqual(['egger-h1145-16', 'egger-h1145-18'])
    expect(filterOwnMaterials(materials, meta, { manufacturer: 'Lamarty', collection: '', decorCode: '0101' })
      .map((material) => material.id)).toEqual(['lamarty-0101-16'])
    expect(filterOwnMaterials(materials, meta, { manufacturer: 'Egger', collection: '', decorCode: '0101' })).toEqual([])
  })
})
