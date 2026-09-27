import { describe, expect, it } from 'vitest'
import { polygonDraftResult, polygonCommitResult } from '../lib/f32PolygonDraft'
import { SEED_CATALOG } from '../src/core/seed'
import type { BoardSpec } from '../src/core/tree'

describe('F32 UI decisions', () => {
  it('validates vertices and segment bands with the core polygon rules', () => {
    const points = [
      { x: '0', y: '0' }, { x: '600', y: '0' }, { x: '600', y: '160' },
      { x: '220', y: '160' }, { x: '220', y: '400' }, { x: '0', y: '400' },
    ]
    const bands = ['', '', '', '', '', '']
    expect(polygonDraftResult(points, bands, 600, 400, SEED_CATALOG).contour?.points).toHaveLength(6)
    expect(polygonDraftResult([{ ...points[0]!, x: '0.5' }, ...points.slice(1)], bands,
      600, 400, SEED_CATALOG).error).toContain('points[0].x')
    expect(polygonDraftResult(points, bands.slice(1), 600, 400, SEED_CATALOG).error)
      .toContain('bands')
  })

  it('refuses to silently discard rectangular edges or existing cutouts', () => {
    const contour = polygonDraftResult([
      { x: '0', y: '0' }, { x: '600', y: '0' }, { x: '600', y: '400' }, { x: '0', y: '400' },
    ], ['', '', '', ''], 600, 400, SEED_CATALOG).contour!
    const board = { length: 600, width: 400,
      edges: { L1: { bandId: SEED_CATALOG.edgeBands[0]!.id }, L2: null, W1: null, W2: null },
      cutouts: [{ shape: 'circle' }] } as unknown as BoardSpec
    expect(polygonCommitResult(board, contour).error).toContain('edges')
    expect(polygonCommitResult({ ...board, edges: { L1: null, L2: null, W1: null, W2: null } }, contour).error)
      .toContain('cutouts')
  })
})
