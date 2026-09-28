import { describe, expect, it } from 'vitest'
import { cabinetCountLabel } from '../lib/viewerCount'

describe('клиент бетінің корпус санағы', () => {
  it('орысша 1/2/5 жалғауларын ажыратады', () => {
    expect(cabinetCountLabel(1, 'ru')).toBe('1 корпус')
    expect(cabinetCountLabel(2, 'ru')).toBe('2 корпуса')
    expect(cabinetCountLabel(5, 'ru')).toBe('5 корпусов')
    expect(cabinetCountLabel(13, 'ru')).toBe('13 корпусов')
  })
  it('en/kk/uz тілінде орысша қалдырмайды', () => {
    expect(cabinetCountLabel(2, 'en')).toBe('2 cabinets')
    expect(cabinetCountLabel(2, 'kk')).toBe('2 корпус')
    expect(cabinetCountLabel(2, 'uz')).toBe('2 korpus')
  })
})
