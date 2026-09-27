import { afterEach, describe, expect, it, vi } from 'vitest'
import { applySavedLang, getLang, setLang } from '../lib/i18n'

afterEach(() => {
  setLang('ru')
  vi.unstubAllGlobals()
})

describe('public language URL', () => {
  it('persists the selected language for the next route', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      location: { search: '?lang=kk' },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value) },
      },
    })
    applySavedLang()
    expect(getLang()).toBe('kk')
    expect(values.get('furniture-configurator:lang')).toBe('kk')
  })
})
