/**
 * РАЗМЕРЫ докинг панелінің таза логикасы
 * (`components/panels/dimensionsInfo.ts`).
 *
 * ⚠ CLAUDE.md §0.1: рет әрқашан H × W × D.
 */
import { describe, expect, it } from 'vitest'
import { referenceWardrobe } from './fixtures'
import { dimensionRows } from '../components/panels/dimensionsInfo'

describe('dimensionRows', () => {
  it('рет H, W, D — CLAUDE.md §0.1', () => {
    const rows = dimensionRows(referenceWardrobe)
    expect(rows.map((r) => r.axis)).toEqual(['H', 'W', 'D'])
  })

  it('мәндер cabinet.height/width/depth-пен дәл сәйкес', () => {
    const rows = dimensionRows(referenceWardrobe)
    expect(rows.find((r) => r.axis === 'H')!.value).toBe(referenceWardrobe.height)
    expect(rows.find((r) => r.axis === 'W')!.value).toBe(referenceWardrobe.width)
    expect(rows.find((r) => r.axis === 'D')!.value).toBe(referenceWardrobe.depth)
  })
})
