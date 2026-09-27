import { describe, expect, it } from 'vitest'
import { updateCatalogMaterialName } from '../lib/catalogMaterialName'

describe('F14 catalogue material name', () => {
  it('updates the generated thickness suffix when the thickness changes', () => {
    expect(updateCatalogMaterialName('ЛДСП Дуб Бардолино 16 мм', 'ЛДСП Дуб Бардолино 16 мм', 16, 18))
      .toEqual({ name: 'ЛДСП Дуб Бардолино 18 мм', autoName: 'ЛДСП Дуб Бардолино 18 мм' })
  })

  it('preserves a manually changed name', () => {
    expect(updateCatalogMaterialName('Дуб для клиента', null, 16, 18))
      .toEqual({ name: 'Дуб для клиента', autoName: null })
    expect(updateCatalogMaterialName('Дуб для клиента', 'ЛДСП Дуб Бардолино 16 мм', 16, 18))
      .toEqual({ name: 'Дуб для клиента', autoName: null })
  })
})
