import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'
import { templateProjectTitles } from '../lib/templateProjectTitles'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('F01 template title', () => {
  it('updates only default names', () => {
    expect(templateProjectTitles('Шкаф-пенал', 'Шкаф-пенал', 'Шкаф-пенал', 'Ас үй'))
      .toEqual({ projectName: 'Ас үй', rootName: 'Ас үй' })
    expect(templateProjectTitles('Тапсырыс', 'Менің сахнам', 'Шкаф-пенал', 'Ас үй'))
      .toEqual({ projectName: 'Тапсырыс', rootName: 'Менің сахнам' })
  })

  it('renames default project and root, keeps a user title, and supports undo', () => {
    useConfigurator.getState().reset()
    useConfigurator.getState().loadTemplate('kitchen-base-600')
    const state = useConfigurator.getState()
    expect(state.projectName).toBe(state.cabinets[0]!.name)
    expect(state.root.name).toBe(state.cabinets[0]!.name)
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().projectName).toBe(baseline.projectName)
    useConfigurator.getState().redo()
    expect(useConfigurator.getState().projectName).toBe(state.projectName)

    useConfigurator.getState().loadProject({ ...state.exportProject(), name: 'Тапсырыс №42',
      root: { ...state.root, name: 'Менің сахнам' } })
    useConfigurator.getState().loadTemplate('wardrobe-penal-600')
    expect(useConfigurator.getState().projectName).toBe('Тапсырыс №42')
    expect(useConfigurator.getState().root.name).toBe('Менің сахнам')
  })
})
