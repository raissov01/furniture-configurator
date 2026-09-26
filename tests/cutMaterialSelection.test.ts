import { describe, expect, it } from 'vitest'
import { selectCutPanels, selectCutScene } from '../src/core/cutMaterialSelection'
import type { Panel } from '../src/core/types'
import type { BasisScriptScene } from '../src/core/export/basisScript'

const panels = [{ id: 'a', materialId: 'one' }, { id: 'b', materialId: 'two' }] as Panel[]

describe('temporary cut material selection', () => {
  it('filters without changing the source panels', () => {
    const selected = selectCutPanels(panels, new Set(['two']))
    expect(selected.map((p) => p.id)).toEqual(['a'])
    expect(panels.map((p) => p.id)).toEqual(['a', 'b'])
    expect(selectCutPanels(panels, new Set(['one', 'two']))).toEqual([])
  })

  it('filters script scene panels with the same selection', () => {
    const scene = { nodes: [{ nodeId: 'n', name: 'N', panels, pose: { position: { x: 0, y: 0, z: 0 }, rotationY: 0 } }] } as BasisScriptScene
    expect(selectCutScene(scene, new Set(['two'])).nodes[0]!.panels.map((p) => p.id)).toEqual(['a'])
    expect(scene.nodes[0]!.panels).toBe(panels)
  })
})
