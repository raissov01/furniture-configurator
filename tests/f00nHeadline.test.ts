import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { keepDashWithPreviousWord } from '../lib/typography'
import { siteTranslate } from '../lib/siteLocale'

const landing = readFileSync(new URL('../components/site/LandingPage.tsx', import.meta.url), 'utf8')

describe('F00n лендинг тақырыбы', () => {
  it('тирені алдыңғы сөзбен қатты бос орын арқылы байланыстырады', () => {
    expect(keepDashWithPreviousWord('цена — из одной модели')).toBe('цена\u00a0— из одной модели')
    expect(keepDashWithPreviousWord('price from one model')).toBe('price from one model')
  })

  it('төрт тілдегі тақырыпқа бір ережені қолданады', () => {
    expect(landing).toContain("keepDashWithPreviousWord(tr('Корпус, раскрой и цена — из одной модели'))")
    for (const lang of ['ru', 'kk', 'en', 'uz'] as const) {
      const title = siteTranslate('Корпус, раскрой и цена — из одной модели', lang)
      expect(keepDashWithPreviousWord(title)).not.toMatch(/ —/)
    }
  })
})
