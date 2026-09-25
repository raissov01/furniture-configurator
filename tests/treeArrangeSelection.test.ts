import { describe, expect, it } from 'vitest'
import { arrangeTreeSelection, selectionBoxes } from '../src/core/treeArrange'
import { SEED_CATALOG } from '../src/core/seed'
import { IDENTITY_TRANSFORM, findNode } from '../src/core/tree'
import type { GroupNode, SolidNode } from '../src/core/tree'

const solid = (id: string, x: number, size = 10): SolidNode => ({ kind: 'solid', id, name: id,
  transform: { pos: { x, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, solid: { size: { x: size, y: 10, z: 10 } } })
const root = (): GroupNode => ({ kind: 'group', id: 'root', name: 'root', transform: structuredClone(IDENTITY_TRANSFORM), children: [
  solid('a', 0), solid('b', 20), solid('c', 100),
] })

describe('ағаш нысандарын туралау және тарату', () => {
  it('готовый әлем AABB бойынша үш нысанның аралығын теңестіреді', () => {
    const next = arrangeTreeSelection(root(), ['a', 'b', 'c'], SEED_CATALOG, [], 'x', 'distribute')
    expect(['a', 'b', 'c'].map((id) => findNode(next, id)?.transform.pos.x)).toEqual([0, 50, 100])
  })
  it('max бетке туралау бір undo-ға лайық бір жаңа ағаш шығарады', () => {
    const before = root()
    const next = arrangeTreeSelection(before, ['a', 'b'], SEED_CATALOG, [], 'x', 'max')
    expect(['a', 'b'].map((id) => findNode(next, id)?.transform.pos.x)).toEqual([20, 20])
    expect(findNode(before, 'a')?.transform.pos.x).toBe(0)
  })
  it('90° бұрылған қатты дененің әлем bounds-ын қолданады', () => {
    const tree = root()
    tree.children[0]!.transform.rot.y = 90
    const boxes = selectionBoxes(tree, ['a'], SEED_CATALOG, [])
    expect(boxes[0]?.bounds).toEqual({ min: { x: 0, y: 0, z: -10 }, max: { x: 10, y: 10, z: 0 } })
  })
})
