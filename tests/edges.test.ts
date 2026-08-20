/** CLAUDE.md §8.1 — кромканы шегеру ережесі. Доменнің ең қымбат багы. */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, calculateCutDimensions } from '../src/core/index.js'
import type { EdgeBand, PanelEdges } from '../src/core/index.js'
import { PVC04, PVC2, catalog } from './fixtures.js'

const bands = new Map<string, EdgeBand>(catalog.edgeBands.map((b) => [b.id, b]))

const edges = (L1: string | null, L2: string | null, W1: string | null, W2: string | null): PanelEdges => ({
  L1: L1 ? { bandId: L1 } : null,
  L2: L2 ? { bandId: L2 } : null,
  W1: W1 ? { bandId: W1 } : null,
  W2: W2 ? { bandId: W2 } : null,
})

describe('calculateCutDimensions', () => {
  it('600 мм готовый + екі ұшында 2 мм ПВХ → рез 596 мм', () => {
    const r = calculateCutDimensions(600, 400, edges(null, null, PVC2, PVC2), bands, DEFAULT_SETTINGS)
    expect(r.cutLength).toBe(596)
    expect(r.cutWidth).toBe(400)
  })

  it('ұзын жиектегі кромка ЕНІН қысқартады, ұзындығын емес', () => {
    const r = calculateCutDimensions(600, 400, edges(PVC2, PVC2, null, null), bands, DEFAULT_SETTINGS)
    expect(r.cutLength).toBe(600)
    expect(r.cutWidth).toBe(396)
  })

  it('төрт жиегі де 2 мм → екеуі де 4 мм-ге кішірейеді', () => {
    const r = calculateCutDimensions(600, 400, edges(PVC2, PVC2, PVC2, PVC2), bands, DEFAULT_SETTINGS)
    expect(r).toEqual({ cutLength: 596, cutWidth: 396 })
  })

  it('0.4 мм кромка резден АЛЫНБАЙДЫ (minBandSubtract = 1)', () => {
    const r = calculateCutDimensions(2000, 447, edges(PVC2, null, PVC04, PVC04), bands, DEFAULT_SETTINGS)
    expect(r.cutLength).toBe(2000)
    expect(r.cutWidth).toBe(445)
  })

  it('minBandSubtract түсірілсе 0.4 мм да алынады', () => {
    const r = calculateCutDimensions(2000, 447, edges(null, null, PVC04, PVC04), bands, {
      ...DEFAULT_SETTINGS,
      minBandSubtract: 0.4,
    })
    expect(r.cutLength).toBeCloseTo(1999.2, 5)
  })

  it('белгісіз кромка — үнсіз жұтылмай, қате лақтырады', () => {
    expect(() =>
      calculateCutDimensions(600, 400, edges(null, null, 'no-such-band', null), bands, DEFAULT_SETTINGS),
    ).toThrow(/Кромка табылмады/)
  })
})
