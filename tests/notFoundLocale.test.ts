import { describe, expect, it } from 'vitest'
import { kk } from '../lib/locales/kk'
import { en } from '../lib/locales/en'
import { uz } from '../lib/locales/uz'

describe('404 translation', () => {
  it.each([kk, en, uz])('has a heading and a way home in each language', (locale) => {
    expect(locale['Страница не найдена']).toBeTruthy()
    expect(locale['Вернуться на главную']).toBeTruthy()
  })
})
