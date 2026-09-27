import { describe, expect, it } from 'vitest'
import { panelDisplayLabel } from '../lib/panelDisplay'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'

const translate = (dictionary: Record<string, string>) => (key: string) => dictionary[key] ?? key

describe('өндірістік панель атауы тек UI-де аударылады', () => {
  it('негізгі корпус атауларын аударады', () => {
    expect(panelDisplayLabel('Боковина', translate(kk))).toBe('Бүйір қабырға')
    expect(panelDisplayLabel('Задняя стенка', translate(en))).toBe('Back panel')
    expect(panelDisplayLabel('Крышка', translate(kk))).toBe('Үсті')
  })
  it('артикул не пайдаланушы атауын өзгертпейді', () => {
    expect(panelDisplayLabel('Egger H1145', translate(kk))).toBe('Egger H1145')
  })
  it('үтірден кейінгі жүйе атауын сақтайды', () => {
    expect(panelDisplayLabel('Боковина ящика, Blum', translate(en))).toBe('Drawer side, Blum')
  })
})
