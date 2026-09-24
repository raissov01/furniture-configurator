import { describe, expect, it } from 'vitest'
import { createDefaultLayer, IDENTITY_TRANSFORM } from '../src/core/index'
import { groupNodes, reparentNode, setTreeNodeFlag, ungroupNode } from '../src/core/treeEditing'
import type { GroupNode } from '../src/core/tree'

const position = (x: number, z = 0) => ({ pos: { x, y: 0, z }, rot: { x: 0, y: 0, z: 0 } })
const sample = (): GroupNode => ({
  kind: 'group', id: 'root', name: 'Project', transform: IDENTITY_TRANSFORM,
  children: [
    { kind: 'group', id: 'a', name: 'A', transform: position(100), children: [
      { kind: 'solid', id: 'item', name: 'Item', transform: position(20), solid: { size: { x: 10, y: 10, z: 10 } } },
    ] },
    { kind: 'group', id: 'b', name: 'B', transform: position(300), children: [] },
  ],
})

describe('tree editing', () => {
  it('reparents a node without moving it in world coordinates, then undoes through the immutable root', () => {
    const original = sample()
    const moved = reparentNode(original, 'item', 'b', [createDefaultLayer()])
    expect((moved.children[1] as GroupNode).children[0]!.transform.pos.x).toBe(-180)
    expect((original.children[0] as GroupNode).children).toHaveLength(1)
    expect((moved.children[0] as GroupNode).children).toHaveLength(0)
    expect(() => reparentNode(moved, 'b', 'item', [createDefaultLayer()])).toThrow()
  })

  it('groups siblings and ungroups them in one immutable operation preserving order', () => {
    const original = sample()
    const grouped = groupNodes(original, ['a', 'b'], 'bundle', 'Bundle', [createDefaultLayer()])
    expect(grouped.children.map((node) => node.id)).toEqual(['bundle'])
    expect((grouped.children[0] as GroupNode).children.map((node) => node.id)).toEqual(['a', 'b'])
    expect(ungroupNode(grouped, 'bundle', [createDefaultLayer()])).toEqual(original)
  })

  it('blocks edits under locked ancestors and locked layers', () => {
    const locked = setTreeNodeFlag(sample(), 'a', 'locked', true, [createDefaultLayer()])
    expect(() => reparentNode(locked, 'item', 'b', [createDefaultLayer()])).toThrow(/құлып/)
    const layerLocked = [{ ...createDefaultLayer(), locked: true }]
    expect(() => groupNodes(sample(), ['a', 'b'], 'bundle', 'Bundle', layerLocked)).toThrow(/құлып/)
  })

  it('keeps descendants hidden when dissolving a hidden or invisible-layer group', () => {
    const root = sample()
    const hidden = { ...root, children: [{ ...(root.children[0] as GroupNode), hidden: true }, root.children[1]!] }
    const revealed = ungroupNode(hidden, 'a', [createDefaultLayer()])
    expect(revealed.children[0]).toMatchObject({ id: 'item', hidden: true })
    const layered = { ...root, children: [{ ...(root.children[0] as GroupNode), layerId: 'off' }, root.children[1]!] }
    const dissolved = ungroupNode(layered, 'a', [createDefaultLayer(),
      { id: 'off', name: 'Off', visible: false, locked: false, color: '#000000' }])
    expect(dissolved.children[0]).toMatchObject({ id: 'item', hidden: true })
  })

  it('rejects root unlock and moving a group below its own descendant', () => {
    expect(() => setTreeNodeFlag(sample(), 'root', 'locked', false, [createDefaultLayer()]))
      .toThrow(/root/)
    const root = sample()
    const a = root.children[0] as GroupNode
    a.children.push({ kind: 'group', id: 'nested', name: 'Nested', transform: position(0), children: [] })
    expect(() => reparentNode(root, 'a', 'nested', [createDefaultLayer()])).toThrow(/қамти/)
  })

  it('preserves world position when the target parent is rotated 90 degrees', () => {
    const root = sample()
    const b = root.children[1] as GroupNode
    b.transform.rot.y = 90
    const moved = reparentNode(root, 'item', 'b', [createDefaultLayer()])
    expect((moved.children[1] as GroupNode).children[0]!.transform.pos).toEqual({ x: 0, y: 0, z: -180 })
  })
})
