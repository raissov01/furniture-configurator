import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '@/store/configurator'
import { findNode } from '@/src/core/tree'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('F09 free-node mirror action', () => {
  it('inserts a unique reflected board beside the source and records one undo step', () => {
    const id = useConfigurator.getState().addBoard()
    useConfigurator.setState({ past: [], future: [] })
    const copyId = useConfigurator.getState().mirrorFreeNode(id)
    const state = useConfigurator.getState()
    const copy = findNode(state.root, copyId)
    expect(copy?.kind).toBe('board')
    expect(copy?.transform.pos.x).toBe(-100)
    expect(copyId).not.toBe(id)
    expect(state.activeId).toBe(copyId)
    expect(state.past).toHaveLength(1)
    state.undo()
    expect(findNode(useConfigurator.getState().root, copyId)).toBeUndefined()
  })

  it('keeps unsupported manufacturing operations out of the mirror copy', () => {
    const id = useConfigurator.getState().addBoard()
    useConfigurator.getState().editBoard(id, { cutouts: [{
      id: 'hole', shape: 'rect', corner: 'bottomLeft', x: 10, y: 10, width: 20, height: 20,
    }] })
    const before = useConfigurator.getState().root
    expect(() => useConfigurator.getState().mirrorFreeNode(id)).toThrow(/ойма|контур/)
    expect(useConfigurator.getState().root).toBe(before)
  })

  it('mirrors a group with descendants and avoids IDs from earlier copies', () => {
    const id = useConfigurator.getState().addBoard()
    const other = useConfigurator.getState().addBoard()
    useConfigurator.getState().groupSelected([id, other], 'free-group', 'Топ')
    const first = useConfigurator.getState().mirrorFreeNode('free-group')
    const second = useConfigurator.getState().mirrorFreeNode('free-group')
    expect(first).not.toBe(second)
    const one = findNode(useConfigurator.getState().root, first)
    const two = findNode(useConfigurator.getState().root, second)
    expect(one?.kind).toBe('group')
    expect(two?.kind).toBe('group')
    if (one?.kind === 'group' && two?.kind === 'group') {
      expect(one.children[0]?.id).not.toBe(two.children[0]?.id)
    }
  })
})
