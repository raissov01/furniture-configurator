import { describe, expect, it } from 'vitest'
import { siteTranslate, siteTranslations } from '../lib/siteLocale'
import { demoRows, demoSheet } from '../lib/demo'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('landing translations', () => {
  it('translates the heading, navigation, tariff and FAQ into every supported language', () => {
    for (const lang of ['kk', 'en', 'uz'] as const) {
      for (const text of ['Корпус, раскрой и цена — из одной модели', 'Что получает цех', 'Тарифы', 'Что обычно спрашивают']) {
        expect(siteTranslate(text, lang)).toBeTruthy()
        expect(siteTranslate(text, lang)).not.toBe(text)
      }
    }
  })

  it('has nonempty translations for every site key', () => {
    for (const [key, translations] of Object.entries(siteTranslations)) {
      expect(key).toBeTruthy()
      expect(translations.kk).toBeTruthy()
      expect(translations.en).toBeTruthy()
      expect(translations.uz).toBeTruthy()
    }
  })

  it('covers every Russian literal in the public landing components', () => {
    for (const name of ['app/page.tsx', 'components/site/SiteHeader.tsx', 'components/site/SiteFooter.tsx', 'components/site/SheetFigure.tsx', 'lib/site.ts']) {
      const source = readFileSync(join(process.cwd(), name), 'utf8')
      for (const line of source.split('\n')) {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
        for (const match of line.matchAll(/['"]([^'"\n]*[А-Яа-яЁё][^'"\n]*)['"]/g)) {
          if (/^[\d. /]+мм$/.test(match[1]!)) continue
          expect(siteTranslations[match[1]!], `${name}: ${match[1]}`).toBeDefined()
        }
      }
    }
  })

  it('translates labels coming from the panel engine without changing dimensions', () => {
    for (const label of [...demoRows.map((row) => row.name), ...demoSheet.sheet.parts.map((part) => part.label)]) {
      expect(siteTranslations[label], label).toBeDefined()
    }
  })
})
