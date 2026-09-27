import { describe, expect, it } from 'vitest'
import { visibleMaterials } from '../lib/cutView'

describe('cut view controls', () => {
  it('filters only displayed materials without changing the source', () => {
    const materials = [{ materialId: 'a' }, { materialId: 'b' }]
    expect(visibleMaterials(materials, 'b')).toEqual([{ materialId: 'b' }])
    expect(visibleMaterials(materials, 'all')).toEqual(materials)
    expect(materials).toHaveLength(2)
  })

})
