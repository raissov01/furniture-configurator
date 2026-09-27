import { describe, expect, it } from 'vitest'
import { edgeMetresByBand, generateCabinet, SEED_CATALOG } from '../src/core/index'
import { referenceWardrobe } from './fixtures'

describe('F14 фасад декорының кромкасы', () => {
  it('корпус пен фасад декоры бөлек болса, әрқайсысы өз кромкасын алады', () => {
    const cabinet = {
      ...referenceWardrobe,
      carcassMaterialId: 'ldsp18-h3303',
      frontMaterialId: 'ldsp16-h1145',
      edging: SEED_CATALOG.materials.find((m) => m.id === 'ldsp18-h3303')!.defaultEdging!,
    }
    const panels = generateCabinet(cabinet, SEED_CATALOG)
    const fronts = panels.filter((panel) => panel.role === 'front')
    expect(fronts).toHaveLength(2)
    expect(fronts.every((front) => Object.values(front.edges).every((edge) => edge?.bandId === 'pvc2-h1145'))).toBe(true)
    const metres = edgeMetresByBand(panels)
    expect(metres.get('pvc2-h3303')).toBeCloseTo(7.376, 3)
    expect(metres.get('pvc2-h1145')).toBeCloseTo(9.156, 3)
  })

  it('кромка саясаты белгісіз болса жоба кромкасын алып ескертеді', () => {
    const catalog = {
      ...SEED_CATALOG,
      materials: SEED_CATALOG.materials.map((material) => material.id === 'ldsp16-h3303'
        ? { ...material, defaultEdging: undefined }
        : material),
    }
    const panels = generateCabinet({ ...referenceWardrobe, frontMaterialId: 'ldsp16-h3303' }, catalog)
    const fronts = panels.filter((panel) => panel.role === 'front')
    expect(fronts).toHaveLength(2)
    expect(fronts.every((front) => front.note.includes('defaultEdging') && front.note.includes('config.edging'))).toBe(true)
    expect(fronts[0]?.edges.L1?.bandId).toBe(referenceWardrobe.edging.visibleFront)
  })
})
