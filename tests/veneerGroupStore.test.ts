import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'
import { findNode, parseProjectV4 } from '../src/core/index'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('шпон тобының редактор шекарасы', () => {
  it('бос орынмен қоршалған топты сақтаусыз қабылдамайды', () => {
    const id = useConfigurator.getState().addBoard()
    expect(() => useConfigurator.getState().editBoard(id, { veneerGroup: ' front-A ' })).toThrow(/veneerGroup/)
    const node = findNode(useConfigurator.getState().root, id)
    expect(node?.kind === 'board' ? node.board.veneerGroup : undefined).toBeUndefined()
  })

  it('топты v4 жобаға сақтап, босатқанда өшіреді', () => {
    const id = useConfigurator.getState().addBoard()
    useConfigurator.getState().editBoard(id, { veneerGroup: 'front-A' })
    const saved = parseProjectV4(useConfigurator.getState().exportProject())
    const node = findNode(saved.root, id)
    expect(node?.kind === 'board' ? node.board.veneerGroup : undefined).toBe('front-A')
    useConfigurator.getState().editBoard(id, { veneerGroup: undefined })
    const cleared = findNode(useConfigurator.getState().root, id)
    expect(cleared?.kind === 'board' ? cleared.board.veneerGroup : undefined).toBeUndefined()
  })
})
