/** UI-дың материал клондау әрекеті ағымдағы цех каталогына жазылуы тиіс. */
import { afterEach, describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()

afterEach(() => {
  useConfigurator.setState({ shop: initial.shop, catalog: initial.catalog })
})

describe('цех каталогындағы материалды клондау', () => {
  it('әр басқанда бірегей жазба қосылады; түпнұсқа мен бағасы сақталады', () => {
    const shop = defaultShopProfile('clone-test')
    const original = shop.materials[0]!
    shop.materials[0] = {
      ...original,
      pricePerSheet: 2850000,
      decor: { color: '#b69770', kind: 'wood', mapUrl: 'https://example.com/H1145.jpg', mapSizeMm: { x: 900, y: 600 } },
    }
    useConfigurator.setState({ shop, catalog: catalogOf(shop) })

    useConfigurator.getState().cloneMaterial(original.id)
    useConfigurator.getState().cloneMaterial(original.id)

    const current = useConfigurator.getState()
    const copies = current.shop.materials.slice(-2)
    expect(copies.map((m) => m.id)).toEqual([`${original.id}-copy`, `${original.id}-copy-2`])
    expect(copies.map((m) => m.pricePerSheet)).toEqual([2850000, 2850000])
    expect(copies[0]!.decor).toEqual(shop.materials[0]!.decor)
    expect(current.catalog.materials).toBe(current.shop.materials)
    expect(current.shop.materials[0]).toBe(shop.materials[0])
  })

  it('каталогта жоқ материал қатесін ашық көрсетеді', () => {
    expect(() => useConfigurator.getState().cloneMaterial('жоқ')).toThrow(/материал табылмады/)
  })
})
