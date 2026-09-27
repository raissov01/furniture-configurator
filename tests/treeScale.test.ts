import { describe, expect, it } from 'vitest'
import { defaultCabinet } from '../lib/defaults'
import { createDefaultLayer } from '../src/core/layers'
import { findNode, IDENTITY_TRANSFORM } from '../src/core/tree'
import type { AnnotationNode, BoardNode, CabinetNode, GroupNode, SolidNode } from '../src/core/tree'
import { scaleTreeNode } from '../src/core/treeScale'

const transform = (x: number, y = 0, z = 0, rotationY = 0) => ({
  pos: { x, y, z }, rot: { x: 0, y: rotationY, z: 0 },
})
const scene = (): GroupNode => ({ kind: 'group', id: 'root', name: 'Project', transform: structuredClone(IDENTITY_TRANSFORM), children: [
  { kind: 'group', id: 'g', name: 'G', transform: transform(100), children: [
    { kind: 'cabinet', id: 'cab', name: 'Cabinet', transform: transform(100, 0, 0),
      config: { ...defaultCabinet, id: 'cab', height: 2000, width: 600, depth: 450 } },
    { kind: 'board', id: 'board', name: 'Board', transform: transform(0, 200, 30),
      board: { materialId: 'm', length: 200, width: 100, orientation: { length: 'y', width: 'x', thickness: 'z' },
        role: 'custom', grainAlongLength: false, edges: { L1: null, L2: null, W1: null, W2: null } } },
    { kind: 'solid', id: 'solid', name: 'Solid', transform: transform(10, 0, 0, 90), solid: { size: { x: 40, y: 50, z: 60 } } },
  ] },
] })
const layers = [createDefaultLayer()]

describe('Scale tool', () => {
  it('scales group child positions and parametric cabinet H × W × D in integer mm', () => {
    const original = scene()
    const next = scaleTreeNode(original, 'g', { x: 150, y: 150, z: 150 }, layers)
    expect(findNode(next, 'g')?.transform.pos).toEqual({ x: 100, y: 0, z: 0 })
    expect(findNode(next, 'cab')?.transform.pos.x).toBe(150)
    expect((findNode(next, 'cab') as CabinetNode).config).toMatchObject({ height: 3000, width: 900, depth: 675 })
    expect((findNode(next, 'board') as BoardNode).board).toMatchObject({ length: 300, width: 150 })
    expect((findNode(next, 'board') as BoardNode).transform.pos).toEqual({ x: 0, y: 300, z: 45 })
    expect((findNode(original, 'cab') as CabinetNode).config.width).toBe(600)
  })

  it('maps anisotropic group axes through a 90 degree child rotation', () => {
    const original = scene()
    const next = scaleTreeNode(original, 'g', { x: 200, y: 100, z: 50 }, layers)
    const solid = findNode(next, 'solid') as SolidNode
    expect(solid.transform.pos.x).toBe(20)
    expect(solid.solid.size).toEqual({ x: 20, y: 50, z: 120 })
    expect((findNode(next, 'cab') as CabinetNode).config).toMatchObject({ height: 2000, width: 1200, depth: 225 })
  })

  it('scales the position and font size of text inside a selected group', () => {
    const original = scene()
    const group = original.children[0] as GroupNode
    const note: AnnotationNode = { kind: 'annotation', id: 'note', name: 'Note', transform: transform(40, 20, 10),
      annotation: { text: 'Socket', fontSize: 80, color: '#262626' } }
    const withText: GroupNode = { ...original, children: [{ ...group, children: [...group.children, note] }] }
    const scaled = scaleTreeNode(withText, 'g', { x: 125, y: 125, z: 125 }, layers)
    expect((findNode(scaled, 'note') as AnnotationNode).transform.pos).toEqual({ x: 50, y: 25, z: 13 })
    expect((findNode(scaled, 'note') as AnnotationNode).annotation.fontSize).toBe(100)
  })

  it('keeps sheet thickness physical, rejects invalid percentages and a locked descendant', () => {
    const original = scene()
    const scaled = scaleTreeNode(original, 'board', { x: 100, y: 200, z: 200 }, layers)
    expect((findNode(scaled, 'board') as BoardNode).board).toMatchObject({ length: 400, width: 100, materialId: 'm' })
    expect(() => scaleTreeNode(original, 'g', { x: 0, y: 100, z: 100 }, layers)).toThrow(/scale|масштаб|пайыз/)
    const group = original.children[0] as GroupNode
    const locked = { ...original, children: [{ ...group, children: [group.children[0]!, { ...group.children[1]!, locked: true }, group.children[2]!] }] }
    expect(() => scaleTreeNode(locked, 'g', { x: 150, y: 150, z: 150 }, layers)).toThrow(/құлып/)
    expect(findNode(original, 'cab')?.transform.pos.x).toBe(100)
  })

  it('rejects nonuniform scaling of a descendant at an oblique angle', () => {
    const original = scene()
    const group = original.children[0] as GroupNode
    const tilted = { ...original, children: [{ ...group, children: [
      { ...group.children[0]!, transform: transform(100, 0, 0, 45) }, ...group.children.slice(1),
    ] }] }
    expect(() => scaleTreeNode(tilted, 'g', { x: 200, y: 100, z: 100 }, layers)).toThrow(/rot|бұрыш/)
  })

  it('rejects board machining coordinates that would no longer match the scaled geometry', () => {
    const original = scene()
    const group = original.children[0] as GroupNode
    const machined = { ...original, children: [{ ...group, children: [group.children[0]!, {
      ...group.children[1]!, board: { ...(group.children[1] as BoardNode).board,
        drilling: [{ face: 'inner' as const, x: 37, y: 50, diameter: 5, depth: 8, purpose: 'shelfPin' as const }] },
    }, group.children[2]!] }] }
    expect(() => scaleTreeNode(machined, 'g', { x: 150, y: 150, z: 150 }, layers)).toThrow(/board\.drilling/)
  })

  it('validates the selected node before a nominal 100 percent no-op', () => {
    expect(() => scaleTreeNode(scene(), 'missing', { x: 100, y: 100, z: 100 }, layers)).toThrow(/nodeId/)
    const original = scene()
    const group = original.children[0] as GroupNode
    const locked = { ...original, children: [{ ...group, locked: true }] }
    expect(() => scaleTreeNode(locked, 'g', { x: 100, y: 100, z: 100 }, layers)).toThrow(/құлып/)
  })
})
