import { describe, expect, it } from 'vitest'
import { arPageText, arPageLanguage } from '../lib/arPageText'

describe('AR бетінің тілі', () => {
  it('тек төрт тілді қабылдайды', () => {
    expect(arPageLanguage('en')).toBe('en')
    expect(arPageLanguage('uz')).toBe('uz')
    expect(arPageLanguage('<script>')).toBe('ru')
  })
  it('нұсқау мен жүктеу қатесін аударады', () => {
    expect(arPageText('en').hint).toMatch(/camera/i)
    expect(arPageText('uz').error).not.toMatch(/Не удалось/)
    expect(arPageText('kk').button).not.toBe(arPageText('ru').button)
  })
})
