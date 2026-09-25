import { afterEach, describe, expect, it } from 'vitest'
import { findNode, flattenTree, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { PVC2, referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
const s = () => useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('еркін тақтаның canonical редакторы', () => {
  it('тақта қосады, төрт кромка және қол присадкасы резге өтеді, v4/undo сақтайды', () => {
    s().loadProject(parseProjectV4(referenceProject))
    const before = s().root.children.length
    const id = s().addBoard()
    expect(s().root.children).toHaveLength(before + 1)
    const board = findNode(s().root, id)
    expect(board?.kind).toBe('board')
    if (board?.kind !== 'board') throw new Error('board expected')
    expect(board.board.role).toBe('custom')
    s().editBoard(id, { length: 600, width: 400,
      edges: { L1: { bandId: PVC2 }, L2: null, W1: { bandId: PVC2 }, W2: { bandId: PVC2 } },
      drilling: [{ face: 'inner', x: 30, y: 30, diameter: 5, depth: 8, purpose: 'shelfPin' }] })
    const panel = flattenTree(s().root, s().catalog, s().projectSettings ?? s().shop.settings, s().layers)
      .nodes.find((node) => node.nodeId === id)?.panels[0]
    expect(panel).toMatchObject({ finishedLength: 600, finishedWidth: 400, cutLength: 596, cutWidth: 398 })
    expect(panel?.drilling).toHaveLength(1)
    const saved = parseProjectV4(s().exportProject())
    expect(findNode(saved.root, id)).toEqual(findNode(s().root, id))
    s().undo()
    expect(findNode(s().root, id)).toEqual(board)
    s().redo()
    expect(findNode(s().root, id)).toEqual(findNode(saved.root, id))
  })

  it('орын бүтін мм; құлыпталған тақта өңделмейді', () => {
    s().loadProject(parseProjectV4(referenceProject))
    const id = s().addBoard()
    expect(() => s().setBoardPosition(id, { x: 10.5, y: 0, z: 0 })).toThrow(/бүтін/)
    s().setBoardPosition(id, { x: 120, y: 30, z: 80 })
    expect(findNode(s().root, id)?.transform.pos).toEqual({ x: 120, y: 30, z: 80 })
    s().setNodeLocked(id, true)
    expect(() => s().editBoard(id, { length: 700 })).toThrow()
  })
})
