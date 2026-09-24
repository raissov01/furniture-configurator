/** Цех UI-ындағы баға өрістерін түзету мен прайс ауыстыру бір күйге түсуі тиіс. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogOf, defaultShopProfile } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()

afterEach(() => {
  useConfigurator.setState({ shop: initial.shop, catalog: initial.catalog })
  vi.unstubAllGlobals()
})

describe('прайс-парақтары дүкен күйінде', () => {
  it('UI баға editShop өзгерісі select away/back және reload кезінде сақталады', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        setItem: (key: string, value: string) => storage.set(key, value),
        getItem: (key: string) => storage.get(key) ?? null,
      },
    })
    const base = defaultShopProfile('price-ui-test')
    useConfigurator.setState({ shop: base, catalog: catalogOf(base) })
    const originalId = base.activePriceListId
    const firstMaterialId = base.materials[0]!.id

    useConfigurator.getState().editShop({
      materials: base.materials.map((m) => m.id === firstMaterialId ? { ...m, pricePerSheet: 2_850_000 } : m),
    })
    expect(useConfigurator.getState().shop.priceLists[0]!.materialPrices[firstMaterialId]!.pricePerSheet)
      .toBe(2_850_000)
    useConfigurator.getState().createPriceList('Көтерме', 'copy')
    const wholesaleId = useConfigurator.getState().shop.activePriceListId
    expect(useConfigurator.getState().shop.materials[0]!.pricePerSheet).toBe(2_850_000)
    useConfigurator.getState().editShop({
      materials: useConfigurator.getState().shop.materials.map((m) =>
        m.id === firstMaterialId ? { ...m, pricePerSheet: 2_100_000 } : m),
    })
    expect(useConfigurator.getState().shop.priceLists[1]!.materialPrices[firstMaterialId]!.pricePerSheet)
      .toBe(2_100_000)

    useConfigurator.getState().selectPriceList(originalId)
    expect(useConfigurator.getState().shop.materials[0]!.pricePerSheet).toBe(2_850_000)
    useConfigurator.getState().selectPriceList(wholesaleId)
    expect(useConfigurator.getState().shop.materials[0]!.pricePerSheet).toBe(2_100_000)
    expect(storage.get('furniture-configurator:shop')).toContain('Көтерме')

    useConfigurator.setState({ shop: base, catalog: catalogOf(base) })
    useConfigurator.getState().hydrateShop()
    expect(useConfigurator.getState().shop.activePriceListId).toBe(wholesaleId)
    expect(useConfigurator.getState().shop.materials[0]!.pricePerSheet).toBe(2_100_000)
    useConfigurator.getState().selectPriceList(originalId)
    expect(useConfigurator.getState().shop.materials[0]!.pricePerSheet).toBe(2_850_000)
  })
})
