import { describe, expect, it } from 'vitest'
import { defaultCabinet } from '../lib/defaults'
import { createDefaultLayer } from '../src/core/layers'
import { findNode, IDENTITY_TRANSFORM } from '../src/core/tree'
import type { BoardNode, CabinetNode, GroupNode } from '../src/core/tree'
import { copyNodeProperties, pasteNodeProperties } from '../src/core/treeProperties'

const board = (id: string, length: number, materialId = 'source'): BoardNode => ({
  kind: 'board', id, name: id, transform: structuredClone(IDENTITY_TRANSFORM),
  board: { materialId, length, width: 220, orientation: { length: 'y', width: 'x', thickness: 'z' },
    grainAlongLength: true, role: 'custom', edges: { L1: { bandId: 'pvc2' }, L2: null, W1: null, W2: { bandId: 'pvc1' } } },
})
const root = (): GroupNode => ({ kind: 'group', id: 'root', name: 'Project', transform: structuredClone(IDENTITY_TRANSFORM),
  children: [board('a', 600), board('b', 400, 'target'), board('c', 300, 'target')],
})
const layers = [createDefaultLayer()]

describe('Copy/Paste properties', () => {
  it('copies only chosen board groups to multiple targets in one immutable operation', () => {
    const original = root()
    const copied = copyNodeProperties(original, 'a', ['material', 'edges'])
    const next = pasteNodeProperties(original, copied, ['b', 'c'], layers)
    for (const id of ['b', 'c']) {
      const target = findNode(next, id) as BoardNode
      expect(target.board.materialId).toBe('source')
      expect(target.board.edges).toEqual((findNode(original, 'a') as BoardNode).board.edges)
      expect(target.board.length).toBe(id === 'b' ? 400 : 300)
    }
    expect((findNode(original, 'b') as BoardNode).board.materialId).toBe('target')
  })

  it('copies finished dimensions separately and snapshots source values', () => {
    const original = root()
    const copied = copyNodeProperties(original, 'a', ['dimensions'])
    const changed = { ...original, children: [board('a', 900), ...original.children.slice(1)] }
    const next = pasteNodeProperties(changed, copied, ['b'], layers)
    expect((findNode(next, 'b') as BoardNode).board.length).toBe(600)
    expect((findNode(next, 'b') as BoardNode).board.width).toBe(220)
  })

  it('snapshots nested edge selections at copy time', () => {
    const original = root()
    const copied = copyNodeProperties(original, 'a', ['edges'])
    const edge = (findNode(original, 'a') as BoardNode).board.edges.L1
    if (!edge) throw new Error('test fixture missing L1 band')
    edge.bandId = 'changed-after-copy'
    const next = pasteNodeProperties(original, copied, ['b'], layers)
    expect((findNode(next, 'b') as BoardNode).board.edges.L1).toEqual({ bandId: 'pvc2' })
  })

  it('copies cabinet H × W × D and materials but rejects unrelated edge group', () => {
    const source: CabinetNode = { kind: 'cabinet', id: 'cab-a', name: 'A', transform: structuredClone(IDENTITY_TRANSFORM),
      config: { ...defaultCabinet, id: 'cab-a', height: 1900, width: 700, depth: 500 } }
    const target: CabinetNode = { ...source, id: 'cab-b', config: { ...defaultCabinet, id: 'cab-b' } }
    const tree: GroupNode = { ...root(), children: [source, target] }
    const copied = copyNodeProperties(tree, 'cab-a', ['material', 'dimensions'])
    const result = pasteNodeProperties(tree, copied, ['cab-b'], layers)
    expect((findNode(result, 'cab-b') as CabinetNode).config).toMatchObject({ height: 1900, width: 700, depth: 500,
      carcassMaterialId: source.config.carcassMaterialId, frontMaterialId: source.config.frontMaterialId,
      backMaterialId: source.config.backMaterialId })
    expect(() => copyNodeProperties(tree, 'cab-a', ['edges'])).toThrow(/edges|кромк/)
  })

  it('rejects a locked or mismatched target atomically', () => {
    const original = root()
    const copied = copyNodeProperties(original, 'a', ['material'])
    const locked = { ...original, children: [original.children[0]!, original.children[1]!, { ...original.children[2]!, locked: true }] }
    expect(() => pasteNodeProperties(locked, copied, ['b', 'c'], layers)).toThrow(/құлып/)
    const withCabinet = { ...original, children: [...original.children, {
      kind: 'cabinet' as const, id: 'cab', name: 'Cabinet', transform: structuredClone(IDENTITY_TRANSFORM), config: defaultCabinet,
    }] }
    expect(() => pasteNodeProperties(withCabinet, copied, ['b', 'cab'], layers)).toThrow(/түр|kind/)
    expect((findNode(original, 'b') as BoardNode).board.materialId).toBe('target')
  })
})
