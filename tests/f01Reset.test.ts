import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('F01 project reset', () => {
  it('clears client and price, undo restores both, redo clears again', () => {
    useConfigurator.getState().reset()
    useConfigurator.getState().editProjectInfo({ client: 'Аудит F01' })
    useConfigurator.getState().editPriceOverrides({ salePrice: 12345 })
    useConfigurator.getState().reset()
    expect(useConfigurator.getState().projectInfo).toEqual({})
    expect(useConfigurator.getState().priceOverrides).toEqual({})
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().projectInfo.client).toBe('Аудит F01')
    expect(useConfigurator.getState().priceOverrides.salePrice).toBe(12345)
    useConfigurator.getState().redo()
    expect(useConfigurator.getState().projectInfo).toEqual({})
    expect(useConfigurator.getState().priceOverrides).toEqual({})
  })

  it('keeps metadata edits in the same undo history as project actions', () => {
    useConfigurator.getState().reset()
    useConfigurator.getState().editProjectInfo({ client: 'Бірінші' })
    useConfigurator.getState().editPriceOverrides({ salePrice: 4000 })
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().projectInfo.client).toBe('Бірінші')
    expect(useConfigurator.getState().priceOverrides).toEqual({})
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().projectInfo).toEqual({})
    useConfigurator.getState().redo()
    expect(useConfigurator.getState().projectInfo.client).toBe('Бірінші')
  })
})
