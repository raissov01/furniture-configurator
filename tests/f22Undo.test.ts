import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()

afterEach(() => {
  useConfigurator.setState(initial)
  vi.unstubAllGlobals()
})

describe('F22 баға тарихы', () => {
  it('сату бағасы мен жолдық жеңілдікті Undo/Redo қайтарады', () => {
    const local = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { setItem: (key: string, value: string) => local.set(key, value) } })
    useConfigurator.setState({ past: [], future: [], lastEditKey: null, shareSession: null })
    const store = useConfigurator.getState()
    const lineDiscounts = { 'materials:test': { kind: 'amount' as const, value: 100 } }
    store.editPriceOverrides({ salePrice: 12_500_025 })
    expect(useConfigurator.getState().past).toHaveLength(1)
    store.editPriceOverrides({ lineDiscounts })
    expect(useConfigurator.getState().past).toHaveLength(2)
    store.undo()
    expect(useConfigurator.getState().priceOverrides).toEqual({ salePrice: 12_500_025 })
    store.undo()
    expect(useConfigurator.getState().priceOverrides).toEqual(initial.priceOverrides)
    store.redo()
    store.redo()
    expect(useConfigurator.getState().priceOverrides).toEqual({ salePrice: 12_500_025, lineDiscounts })
  })
})
