import { afterEach, describe, expect, it } from 'vitest'
import { copyNodeProperties, findNode, parseProjectV4 } from '../src/core/index'
import type { BoardNode, CabinetNode } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()
afterEach(() => useConfigurator.setState(initial, true))

describe('property paste and scale store actions', () => {
  it('pastes dimensions to selected boards in one undo step', () => {
    const a = useConfigurator.getState().addBoard()
    const b = useConfigurator.getState().addBoard()
    useConfigurator.getState().editBoard(a, { length: 400, width: 200 })
    useConfigurator.getState().editBoard(b, { length: 250, width: 150 })
    const before = useConfigurator.getState()
    const copied = copyNodeProperties(before.root, a, ['dimensions'])
    before.pasteProperties(copied, [b])
    const after = useConfigurator.getState()
    expect((findNode(after.root, b) as BoardNode).board).toMatchObject({ length: 400, width: 200 })
    expect(after.past).toHaveLength(before.past.length + 1)
    after.undo()
    expect((findNode(useConfigurator.getState().root, b) as BoardNode).board).toMatchObject({ length: 250, width: 150 })
  })

  it('scales parametric cabinet config, saves v4 and undoes as one action', () => {
    const before = useConfigurator.getState()
    const id = before.cabinets[0]!.id
    const width = before.cabinets[0]!.width
    before.scaleNode(id, { x: 110, y: 100, z: 100 })
    const after = useConfigurator.getState()
    expect((findNode(after.root, id) as CabinetNode).config.width).toBe(Math.round(width * 1.1))
    expect((findNode(parseProjectV4(after.exportProject()).root, id) as CabinetNode).config.width).toBe(Math.round(width * 1.1))
    expect(after.past).toHaveLength(before.past.length + 1)
    after.undo()
    expect((findNode(useConfigurator.getState().root, id) as CabinetNode).config.width).toBe(width)
  })

  it('rejects an unbuildable cabinet scale without changing project or history', () => {
    const before = useConfigurator.getState()
    const id = before.cabinets[0]!.id
    expect(() => before.scaleNode(id, { x: 1, y: 100, z: 100 })).toThrow()
    expect(useConfigurator.getState().root).toBe(before.root)
    expect(useConfigurator.getState().past).toHaveLength(before.past.length)
  })

  it('validates an edited hidden board before it can later enter production', () => {
    const id = useConfigurator.getState().addBoard()
    const bandId = useConfigurator.getState().catalog.edgeBands.find((band) => band.thickness >= 2)!.id
    useConfigurator.getState().editBoard(id, { edges: { L1: { bandId }, L2: { bandId }, W1: { bandId }, W2: { bandId } } })
    useConfigurator.getState().setNodeHidden(id, true)
    const before = useConfigurator.getState()
    expect(() => before.scaleNode(id, { x: 1, y: 1, z: 100 })).toThrow(/cutLength|cutWidth|рез|өлшем/)
    expect(useConfigurator.getState().root).toBe(before.root)
  })
})
