import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { libraryLocalKey, readLocalLibrary, writeLocalLibrary } from '@/lib/libraryLocal'
import { libraryUploadOutcome, importUploadSummary } from '@/lib/librarySyncUi'
import { tf } from '@/lib/i18n'

// Бір браузердегі A мен B кітапханалары ешбір ортақ кілтті қолданбайды.
describe('F25 жеке кітапхана UI', () => {
  it('жергілікті сақтау кілтін userId бойынша бөледі', () => {
    expect(libraryLocalKey(null)).toBe('furniture-configurator:library-v1')
    expect(libraryLocalKey('account-a')).not.toBe(libraryLocalKey('account-b'))
    expect(libraryLocalKey('account-a')).not.toBe(libraryLocalKey(null))
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    writeLocalLibrary(storage, [], 'account-a')
    expect(readLocalLibrary(storage, 'account-b')).toEqual([])
    expect(values.has(libraryLocalKey('account-a'))).toBe(true)
    expect(values.has(libraryLocalKey(null))).toBe(false)
  })

  it('409 кезінде аккаунтқа сақталды деп айтпайды', () => {
    expect(libraryUploadOutcome(409, 'Кітапхана шегі: 200 элемент')).toEqual({
      savedToAccount: false,
      message: 'Сохранено только на этом устройстве',
      error: 'Кітапхана шегі: 200 элемент',
    })
    expect(libraryUploadOutcome(200, null).savedToAccount).toBe(true)
  })

  it('импорттың ішінара синхрондалуын нақты санмен көрсетеді', () => {
    expect(tf(importUploadSummary(2, 5), { saved: 2, total: 5 })).toContain('2 из 5')
    expect(tf(importUploadSummary(5, 5), { saved: 5, total: 5 })).not.toContain('2 из 5')
  })

  it('390 px карточкалары бір бағанда және әрекеттер тігінен орналасады', () => {
    const source = readFileSync(new URL('../components/panels/PersonalLibraryPanel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('grid-cols-1 gap-1 sm:grid-cols-2')
    expect(source).toContain('flex-col gap-1 xl:flex-row')
  })
})
