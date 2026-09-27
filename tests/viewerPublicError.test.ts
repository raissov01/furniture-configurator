import { describe, expect, it } from 'vitest'
import { viewerHashError, viewerPressedState } from '../components/viewerPublicError'
import { ConfigValidationError } from '../src/core/index'
import { kk } from '../lib/locales/kk'
import { en } from '../lib/locales/en'
import { uz } from '../lib/locales/uz'

describe('public viewer link errors', () => {
  it('distinguishes an empty link from invalid project data', () => {
    expect(viewerHashError('', null)).toBe('В ссылке нет проекта. Попросите отправить её целиком.')
    expect(viewerHashError('bad-data', new Error('raw stack detail'))).toBe('Не удалось открыть проект по этой ссылке.')
    expect(viewerHashError('bad-data', new ConfigValidationError('link', 'raw parser detail')))
      .toBe('Ссылка на проект повреждена или устарела. Попросите новую ссылку.')
  })

  it('exposes true and false for each viewer toggle', () => {
    const state = { walk: false, openness: 0, preset: 'front' as const }
    expect(viewerPressedState(state, 'walk')).toBe(false)
    expect(viewerPressedState(state, 'fronts')).toBe(false)
    expect(viewerPressedState({ ...state, openness: 1 }, 'fronts')).toBe(true)
    expect(viewerPressedState(state, 'front')).toBe(true)
    expect(viewerPressedState(state, 'room')).toBe(false)
  })

  it.each([kk, en, uz])('localizes public link errors', (locale) => {
    expect(locale[viewerHashError('', null)]).toBeTruthy()
    expect(locale[viewerHashError('bad', new Error('raw'))]).toBeTruthy()
  })
})
