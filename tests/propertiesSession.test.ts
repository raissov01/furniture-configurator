import { beforeEach, describe, expect, it } from 'vitest'
import { capturePropertiesSession, commitPropertiesName, restorePropertiesSession } from '../lib/propertiesSession'
import { useConfigurator } from '../store/configurator'

beforeEach(() => useConfigurator.getState().reset())

describe('Properties modal transaction', () => {
  it('Cancel restores edited cabinet and its undo history', () => {
    const state = useConfigurator.getState()
    state.addCabinet()
    const baseline = capturePropertiesSession()
    const initial = useConfigurator.getState().cabinets.find((cabinet) => cabinet.id === useConfigurator.getState().activeId)!
    useConfigurator.getState().edit('width', { width: initial.width + 100 })
    expect(useConfigurator.getState().cabinets.find((cabinet) => cabinet.id === useConfigurator.getState().activeId)!.width).toBe(initial.width + 100)
    restorePropertiesSession(baseline)
    expect(useConfigurator.getState().cabinets.find((cabinet) => cabinet.id === useConfigurator.getState().activeId)!.width).toBe(initial.width)
    expect(useConfigurator.getState().past).toEqual(baseline.past)
    expect(useConfigurator.getState().future).toEqual(baseline.future)
  })

  it('rejects an empty name and commits a valid name before Apply', () => {
    useConfigurator.getState().addBoard()
    const id = useConfigurator.getState().activeId
    const before = useConfigurator.getState().root.children.find((node) => node.id === id)!.name
    expect(commitPropertiesName(id, '   ')).toBe('Название не может быть пустым')
    expect(useConfigurator.getState().root.children.find((node) => node.id === id)!.name).toBe(before)
    expect(commitPropertiesName(id, 'Жаңа тақта')).toBeNull()
    expect(useConfigurator.getState().root.children.find((node) => node.id === id)!.name).toBe('Жаңа тақта')
  })

  it('Cancel restores free-board edits and global dimension visibility', () => {
    useConfigurator.getState().addBoard()
    const baseline = capturePropertiesSession()
    const id = useConfigurator.getState().activeId
    useConfigurator.getState().editBoard(id, { length: 777 })
    useConfigurator.getState().setShowDimensions(!baseline.showDimensions)
    restorePropertiesSession(baseline)
    expect(useConfigurator.getState().root).toEqual(baseline.root)
    expect(useConfigurator.getState().showDimensions).toBe(baseline.showDimensions)
  })
})
