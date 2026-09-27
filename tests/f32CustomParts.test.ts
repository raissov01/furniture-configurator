import { describe, expect, it } from 'vitest'
import { nextCustomPartId, removeCustomPart } from '../lib/f32CustomParts'
import type { CabinetConfig } from '../src/core/types'

describe('F32 UI decisions', () => {
  it('never reuses a custom id and removes all related overrides in one patch', () => {
    const id = nextCustomPartId([{ id: 'custom-1' }], ['custom-1'], 'unique')
    expect(id).toBe('custom-unique')
    expect(nextCustomPartId([], ['custom-reused'], 'reused')).toBe('custom-reused-2')
    const patch = removeCustomPart({
      customParts: [{ id: 'custom-1' }],
      panelCutouts: { 'custom-1': [{ shape: 'circle' }] },
      drillEdits: { 'custom-1': { added: [] } },
      panelCorners: { 'custom-1': { bottomLeft: 2 } },
      panelGrain: { 'custom-1': 'width' },
    } as unknown as CabinetConfig, 'custom-1')
    expect(patch.customParts).toEqual([])
    for (const key of ['panelCutouts', 'drillEdits', 'panelCorners', 'panelGrain'] as const) {
      expect(patch[key]).toEqual({})
    }
  })
})
