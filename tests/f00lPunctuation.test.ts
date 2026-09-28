import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('public UI punctuation', () => {
  it('keeps grammatical dashes but removes decorative list markers and label separators', () => {
    const landing = source('components/site/LandingPage.tsx')
    const translations = source('lib/siteLocale.ts')
    expect(landing).toContain('Корпус, раскрой и цена — из одной модели')
    expect(landing).not.toMatch(/tr\('— /)
    expect(landing).not.toContain('>—</span>')
    expect(translations).not.toMatch(/'\d{2} — /)
    expect(source('components/CodeEntryPage.tsx')).not.toContain('Код — 6 цифр')
  })
})
