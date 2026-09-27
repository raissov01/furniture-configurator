import { describe, expect, it } from 'vitest'
import { catalog, oneSection, withCabinet } from './fixtures'
import { previewFrontEdit } from '../lib/frontEdit'

const fullCatalog = catalog
const cabinet = withCabinet({ sections: oneSection({ fronts: { count: 2, mount: 'overlay' } }) })

describe('F05 front controls', () => {
  it('keeps an invalid count and gap out of the project with the core reason', () => {
    const count = previewFrontEdit(cabinet, 0, { count: 9 }, fullCatalog)
    expect(count).toMatchObject({ ok: false, field: 'sections[0].fronts.count' })
    const gap = previewFrontEdit(cabinet, 0, { gaps: { right: 51 } }, fullCatalog)
    expect(gap).toMatchObject({ ok: false, field: 'sections[0].fronts.gaps.right' })
    expect(cabinet.sections[0]!.fronts!.count).toBe(2)
  })

  it('rejects count eight before it reaches the saved project', () => {
    const result = previewFrontEdit(cabinet, 0, { count: 8 }, fullCatalog)
    expect(result).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
  })

  it('rejects a third unsupported door and a shared opening side before commit', () => {
    expect(previewFrontEdit(cabinet, 0, { count: 3 }, fullCatalog)).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
    expect(previewFrontEdit(cabinet, 0, { opening: 'right' }, fullCatalog)).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
    expect(previewFrontEdit(cabinet, 0, { opening: 'left' }, fullCatalog)).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
  })

})
