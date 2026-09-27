import { afterEach, describe, expect, it } from 'vitest'
import { materialUsedInTree } from '../lib/materialUsedInTree'
import { useConfigurator } from '../store/configurator'
import type { GroupNode } from '../src/core/tree'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('F14 material removal', () => {
  it('finds a material on a nested hidden board and in a cabinet nested material field', () => {
    const root = structuredClone(baseline.root) as GroupNode
    const cabinet = root.children.find((node) => node.kind === 'cabinet')
    if (!cabinet || cabinet.kind !== 'cabinet') throw new Error('cabinet fixture required')
    cabinet.config.worktop = { ...cabinet.config.worktop!, materialId: 'nested-material' }
    root.children.push({ ...root, id: 'hidden-group', children: [
      { kind: 'board', id: 'hidden-board', name: 'Hidden', hidden: true,
        transform: root.transform,
        board: { materialId: 'board-material', length: 100, width: 100,
          orientation: { length: 'x', width: 'y', thickness: 'z' },
          edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' },
      },
    ] })
    expect(materialUsedInTree(root, 'board-material')).toBe(true)
    expect(materialUsedInTree(root, 'nested-material')).toBe(true)
    expect(materialUsedInTree(root, 'unused-material')).toBe(false)
  })

  it('keeps a shop material referenced by a free board even if no cabinet uses it', () => {
    const s = useConfigurator.getState()
    const id = s.addBoard()
    const board = useConfigurator.getState().root.children.find((node) => node.id === id)
    if (!board || board.kind !== 'board') throw new Error('board fixture required')
    const materialId = board.board.materialId
    expect(useConfigurator.getState().cabinets.every((cabinet) =>
      cabinet.carcassMaterialId !== materialId && cabinet.frontMaterialId !== materialId && cabinet.backMaterialId !== materialId)).toBe(true)
    useConfigurator.getState().removeMaterial(materialId)
    expect(useConfigurator.getState().shop.materials.some((material) => material.id === materialId)).toBe(true)
  })
})
