import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('редактор привязка баптауы', () => {
  it('тор мен шек өзгереді, өндірістік тарихқа жазылмайды', () => {
    useConfigurator.setState({ past: [] })
    useConfigurator.getState().setSnapOptions({ grid: 20, tolerance: 5 })
    expect(useConfigurator.getState().snapOptions).toEqual({ grid: 20, tolerance: 5 })
    expect(useConfigurator.getState().past).toHaveLength(0)
  })
  it('теріс және бөлшек мәндер қабылданбайды', () => {
    expect(() => useConfigurator.getState().setSnapOptions({ grid: -1, tolerance: 8 })).toThrow(/grid/)
    expect(() => useConfigurator.getState().setSnapOptions({ grid: 10, tolerance: 1.5 })).toThrow(/tolerance/)
  })
})
