import { describe, expect, it } from 'vitest'
import {
  BASIS_FITTINGS,
  basisFittingStats,
  parseBasisFittingName,
} from '../src/core/data/basisFittings'

describe('Базис фурнитура атаулары', () => {
  it('артикул, өндіруші және тұтқа түрін шығарады', () => {
    expect(parseBasisFittingName('BH.04.128.BLM Ручка-скоба 128мм, чёрный матовый.fr3d')).toMatchObject({
      article: 'BH.04.128.BLM', manufacturer: null, kind: 'handle', model: 'bar',
    })
    expect(parseBasisFittingName('2036.16.31 Ручка-кнопка, хром матовый')).toMatchObject({
      article: '2036.16.31', kind: 'handle', model: 'knob',
    })
  })

  it('өндіруші/серия атауларын фурнитура түріне жіктейді', () => {
    expect(parseBasisFittingName('BOYARD направляющие B-Slide DB7772Zn-500 soft-closing')).toMatchObject({
      manufacturer: 'Boyard', article: 'DB7772Zn', kind: 'runner', series: 'B-Slide',
    })
    expect(parseBasisFittingName('FGV Excel короб ящика H120')).toMatchObject({
      manufacturer: 'FGV', kind: 'drawer-box', series: 'Excel', dimensionsMm: [120],
    })
    const profile = parseBasisFittingName('MODUS профиль фасадный MZ01, A00 серебро')
    expect(profile).toMatchObject({ manufacturer: 'MODUS', article: 'MZ01', kind: 'profile' })
    expect(profile).not.toHaveProperty('existingModelId')
  })

  it('барлық 3 645 атауды дерек ретінде қайтарады және unmatched санын көрсетеді', () => {
    expect(BASIS_FITTINGS).toHaveLength(3645)
    expect(new Set(BASIS_FITTINGS.map((item) => item.raw)).size).toBe(3645)
    expect(basisFittingStats()).toMatchObject({ total: 3645, withArticle: expect.any(Number), byManufacturer: expect.any(Object) })
    expect(basisFittingStats().byManufacturer).toMatchObject({ Boyard: 1664, FGV: 1016, MODUS: 511 })
  })
})
