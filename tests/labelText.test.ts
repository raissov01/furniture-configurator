import { describe, expect, it } from 'vitest'
import { labelMaterialText, fitLabelLines } from '../src/core/export/labelText'

describe('жапсырма мәтіні', () => {
  it('материал атауындағы қалыңдықты қайталамайды', () => {
    expect(labelMaterialText('ХДФ 3 мм белый', 3)).toBe('ХДФ 3 мм белый')
    expect(labelMaterialText('Дуб Бардолино', 16)).toBe('Дуб Бардолино, 16 мм')
  })

  it('ұзын атауды екі жолға сыйғызады, ешбір жолды жасырып кесіп тастамайды', () => {
    const lines = fitLabelLines('ЛДСП Egger H1145 Дуб Бардолино, 16 мм', 110, (s) => s.length * 5)
    expect(lines).toHaveLength(2)
    expect(lines.join(' ')).toBe('ЛДСП Egger H1145 Дуб Бардолино, 16 мм')
    expect(lines.every((line) => line.length * 5 <= 110)).toBe(true)
  })
})
