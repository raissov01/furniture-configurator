import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const original = useConfigurator.getState().exportProject()
afterEach(() => useConfigurator.getState().loadProject(original))

describe('cabinet edit history', () => {
  it('does not create undo history or a new tree for an unchanged edit', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const before = useConfigurator.getState()
    const cabinet = before.cabinets.find((item) => item.id === before.activeId)!
    before.edit('height', { height: cabinet.height })
    const after = useConfigurator.getState()
    expect(after.root).toBe(before.root)
    expect(after.past).toBe(before.past)
    expect(after.future).toBe(before.future)
  })
})
