import { afterEach, expect, it } from 'vitest'
import { useConfigurator } from '@/store/configurator'

const saved = useConfigurator.getState().exportProject()
afterEach(() => useConfigurator.getState().loadProject(saved))

it('names a generated kitchen in both project metadata and tree root', () => {
  useConfigurator.setState({ projectName: 'Шкаф-пенал' })
  useConfigurator.getState().loadKitchen({ layout: 'straight', lengthA: 1800, sink: false, upper: false, appliances: false })
  const state = useConfigurator.getState()
  expect(state.projectName).toBe('Кухня')
  expect(state.root.name).toBe('Кухня')
  expect(state.exportProject().name).toBe('Кухня')
})
