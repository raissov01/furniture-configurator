import { describe, expect, it } from 'vitest'
import { kk } from '../lib/locales/kk'
import { LESSONS } from '../src/core/lessonCatalog'

describe('F30 қазақша сабақтар', () => {
  it('анықтама бөлімінің және барлық сабақтардың мәтінін аударады', () => {
    const keys = [
      'Тематические уроки', 'Начать урок', 'Пройдено · повторить',
      ...LESSONS.flatMap((lesson) => [lesson.name, ...lesson.steps.flatMap((step) => [step.title, step.text])]),
    ]
    for (const key of keys) {
      expect(kk[key], key).toBeDefined()
      expect(kk[key]?.trim(), key).not.toBe('')
    }
    expect(kk['Тематические уроки']).toBe('Тақырыптық сабақтар')
    expect(kk['Начать урок']).toBe('Сабақты бастау')
    expect(kk['Габариты']).toBe('Габариттер')
  })
})
