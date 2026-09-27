import { describe, expect, it } from 'vitest'
import { defaultHandleSpec, defaultHandles, defaultHingeSystems } from '../src/core/fittings'
import { catalog, oneSection, withCabinet } from './fixtures'
import { availableVerifiedHinges, compatibleHinges, previewFrontEdit } from '../lib/frontEdit'

const hinges = defaultHingeSystems()
const fullCatalog = { ...catalog, hingeSystems: hinges, handles: defaultHandles() }
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
    expect(result).toMatchObject({ ok: false })
  })

  it('keeps an oversized handle offset out of the model and identifies its field', () => {
    const result = previewFrontEdit(cabinet, 0, { handle: { ...defaultHandleSpec(), edgeOffset: 9999 } }, fullCatalog)
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) {
      expect(result.field).toMatch(/handle\.edgeOffset/)
      expect(result.allowed).toMatch(/\.\./)
    }
  })

  it('rejects a third unsupported door and a shared opening side before commit', () => {
    expect(previewFrontEdit(cabinet, 0, { count: 3 }, fullCatalog)).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
    expect(previewFrontEdit(cabinet, 0, { opening: 'right' }, fullCatalog)).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
    expect(previewFrontEdit(cabinet, 0, { opening: 'left' }, fullCatalog)).toMatchObject({ ok: false, field: 'sections[0].fronts.opening' })
  })

  it('only offers hinges matching mount and clears an old explicit hinge on mount change', () => {
    const overlay = compatibleHinges(hinges, 'overlay')
    const inset = compatibleHinges(hinges, 'inset')
    expect(overlay.length).toBeGreaterThan(0)
    expect(inset.map((h) => h.id)).toContain('hinge-blum-71b3750-inset')
    expect(inset.every((h) => h.mount === 'inset')).toBe(true)
    const withExplicit = withCabinet({ sections: oneSection({ fronts: {
      count: 2, mount: 'overlay', hingeSystemId: overlay[0]!.id,
    } }), settings: { shelfSetback: 20 } })
    expect(previewFrontEdit(withExplicit, 0, { mount: 'inset' }, fullCatalog)).toMatchObject({
      ok: true, fronts: { mount: 'inset', hingeSystemId: undefined },
    })
  })

  it('explains when the shop has no matching hinge system', () => {
    const insetCabinet = withCabinet({ ...cabinet, settings: { shelfSetback: 20 } })
    expect(previewFrontEdit(insetCabinet, 0, { mount: 'inset' }, {
      ...catalog, hingeSystems: compatibleHinges(hinges, 'overlay'),
    })).toMatchObject({ ok: false, field: 'sections[0].fronts.hingeSystemId' })
  })

  it('offers only missing sourced articles for the shop hinge catalog', () => {
    const choices = availableVerifiedHinges(compatibleHinges(hinges, 'overlay'))
    expect(choices.map((hinge) => hinge.id)).toContain('hinge-blum-71b3750-inset')
    expect(choices.every((hinge) => hinge.mount === 'inset' && Boolean(hinge.source))).toBe(true)
    expect(availableVerifiedHinges(hinges)).toEqual([])
  })
})
