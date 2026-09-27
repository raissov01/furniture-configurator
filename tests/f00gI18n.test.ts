import { describe, expect, it } from 'vitest'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'
import { countLabel } from '../lib/countLabel'
import { arPageCopy, arPageLang } from '../lib/arPageCopy'
import { layerUiName } from '../lib/layerUiName'
import { SEED_TEMPLATES, SEED_SETS } from '../src/core/index'

const auditedKeys = [
  'Новый слой', 'Например: Техника', 'Добавить', 'Цвет слоя',
  'Слой по умолчанию нельзя удалить', 'Удалить слой', 'Удалить',
  'Виден', 'Заблокирован', 'Узлы', 'Расчётная цена продажи',
  'Цена продажи (вручную)', 'Поиск…', 'Назад', 'Цена неизвестна',
  'Выйти', 'Готовый', 'Рез', 'Корпус', 'Шаблон', 'Мебель', 'Разное',
] as const

describe('F00g interface translations', () => {
  it.each([['kk', kk], ['en', en], ['uz', uz]] as const)('%s translates audited Russian keys', (_lang, dict) => {
    for (const key of auditedKeys) {
      expect(dict[key], key).toBeTruthy()
      if (key !== 'Корпус') expect(dict[key], key).not.toBe(key)
    }
  })

  it('inflects counts in Russian and translates other languages', () => {
    expect(countLabel(1, 'Шаблон', 'ru')).toBe('1 шаблон')
    expect(countLabel(2, 'Шаблон', 'ru')).toBe('2 шаблона')
    expect(countLabel(5, 'Шаблон', 'ru')).toBe('5 шаблонов')
    expect(countLabel(21, 'Корпус', 'ru')).toBe('21 корпус')
    expect(countLabel(11, 'Корпус', 'ru')).toBe('11 корпусов')
    expect(countLabel(1, 'Шаблон', 'en')).toBe('1 template')
    expect(countLabel(2, 'Шаблон', 'en')).toBe('2 templates')
    expect(countLabel(5, 'Корпус', 'kk')).toBe('5 корпус')
    expect(countLabel(2, 'Корпус', 'uz')).toBe('2 korpus')
    expect(countLabel(2, 'Дверь', 'ru')).toBe('2 двери')
    expect(countLabel(5, 'Ящик', 'ru')).toBe('5 ящиков')
    expect(countLabel(2, 'Дверь', 'en')).toBe('2 doors')
  })

  it('covers all gallery seed names and descriptions', () => {
    for (const dict of [kk, en, uz]) {
      const missing: string[] = []
      for (const template of SEED_TEMPLATES) {
        if (!dict[template.name]) missing.push(template.name)
        if (!dict[template.description]) missing.push(template.description)
      }
      for (const preset of SEED_SETS) {
        if (!dict[preset.name]) missing.push(preset.name)
        if (!dict[preset.description]) missing.push(preset.description)
      }
      expect(missing).toEqual([])
    }
  })

  it('shows translated default layer without changing a custom name', () => {
    const translate = (key: string) => en[key] ?? key
    expect(layerUiName({ id: 'default', name: 'Әдепкі қабат' }, translate)).toBe('Default layer')
    expect(layerUiName({ id: 'custom', name: 'My layer' }, translate)).toBe('My layer')
  })

  it('selects AR copy from a supported language only', () => {
    expect(arPageLang('en')).toBe('en')
    expect(arPageLang('xx')).toBe('ru')
    expect(arPageCopy('uz').action).toBe('Xonada ko‘rish')
  })
})
