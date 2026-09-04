/**
 * Төрт тіл.
 *
 * Ең маңыздысы — СӨЗДІКТЕРДІҢ КІЛТТЕРІ БІРДЕЙ болуы: біреуінде бар жол
 * екіншісінде жоқ болса, сол тілде экранның бір бөлігі орысша қалады да,
 * пайдаланушы «жартылай аударылған» бағдарлама көреді.
 */
import { describe, expect, it } from 'vitest'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'

const dicts = { kk, uz, en }

describe('сөздіктер', () => {
  it('үшеуінде де кілттер БІРДЕЙ', () => {
    const base = Object.keys(kk).sort()
    for (const [name, dict] of Object.entries(dicts)) {
      expect(Object.keys(dict).sort(), name).toEqual(base)
    }
  })

  it('бос аударма жоқ', () => {
    for (const [name, dict] of Object.entries(dicts)) {
      const empty = Object.entries(dict).filter(([, v]) => v.trim() === '')
      expect(empty, name).toEqual([])
    }
  })

  it('орындары бар жолдарда орындар САҚТАЛҒАН', () => {
    for (const [name, dict] of Object.entries(dicts)) {
      for (const [key, value] of Object.entries(dict)) {
        const slots = (key.match(/\{\w+\}/g) ?? []).sort()
        if (slots.length === 0) continue
        expect((value.match(/\{\w+\}/g) ?? []).sort(), `${name}: ${key}`).toEqual(slots)
      }
    }
  })

  it('аудармасы жоқ жол ОРЫСША болып қайтады (сөздік жартылай болуы мүмкін)', () => {
    expect(kk['жоқ-мұндай-жол']).toBeUndefined()
  })
})
