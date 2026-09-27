import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '@/store/configurator'

const initial = useConfigurator.getState()
afterEach(() => useConfigurator.setState(initial))

describe('жобадағы текстура', () => {
  it('декорды жоба файлына қосады және undo қайтарады', () => {
    const material = useConfigurator.getState().catalog.materials[0]!
    const decor = { color: '#ffffff', kind: 'wood' as const,
      mapUrl: 'https://example.com/api/own-catalog/image?id=123', mapSizeMm: { x: 600, y: 450 } }
    useConfigurator.getState().setMaterialDecor(material.id, decor)
    expect(useConfigurator.getState().exportProject().materials?.find((item) => item.id === material.id)?.decor).toEqual(decor)
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().catalog.materials.find((item) => item.id === material.id)?.decor).toEqual(material.decor)
  })
})
