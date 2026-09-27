/**
 * Төрт тіл.
 *
 * Ең маңыздысы — СӨЗДІКТЕРДІҢ КІЛТТЕРІ БІРДЕЙ болуы: біреуінде бар жол
 * екіншісінде жоқ болса, сол тілде экранның бір бөлігі орысша қалады да,
 * пайдаланушы «жартылай аударылған» бағдарлама көреді.
 */
import { readFileSync } from 'node:fs'
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

  it('бір кілт сөздікте екі рет жазылмайды (кейінгісі аударманы басып кетеді)', () => {
    const key = /^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*:/
    for (const name of Object.keys(dicts)) {
      const seen = new Map<string, number>()
      const duplicates: string[] = []
      readFileSync(new URL(`../lib/locales/${name}.ts`, import.meta.url), 'utf8').split('\n').forEach((line, index) => {
        const match = key.exec(line)
        if (!match) return
        const text = (match[1] ?? match[2] ?? '').replace(/\\(.)/g, '$1')
        const first = seen.get(text)
        if (first !== undefined) duplicates.push(`${first}/${index + 1}: ${text}`)
        else seen.set(text, index + 1)
      })
      expect(duplicates, name).toEqual([])
    }
  })

  it('бос аударма жоқ', () => {
    for (const [name, dict] of Object.entries(dicts)) {
      const empty = Object.entries(dict).filter(([, v]) => v.trim() === '')
      expect(empty, name).toEqual([])
    }
  })

  it('телефондағы негізгі жолдар en және uz тілінде орысша қалмайды', () => {
    for (const key of ['Новый замер', 'Сохранить замер', 'Замеры на этом устройстве',
      'Сканировать деталь', 'Монтаж', 'Постоянное хранение разрешено.', 'Стена первого ряда кухни']) {
      expect(en[key], `en: ${key}`).not.toBe(key)
      expect(uz[key], `uz: ${key}`).not.toBe(key)
    }
  })

  it('классикалық мәзір мен көрініс құралдары үш тілде аударылады', () => {
    for (const key of ['Файл', 'Правка', 'Элемент', 'Инструменты', 'Сервис', 'Справка',
      'Новый корпус', 'Выбор', 'Стена С', 'Стена З', 'Стена Ю', 'Стена В', 'Сбросить текущий проект?']) {
      for (const [lang, dictionary] of Object.entries(dicts)) {
        expect(dictionary[key], `${lang}: ${key}`).toBeTruthy()
        expect(dictionary[key], `${lang}: ${key}`).not.toBe(key)
      }
    }
  })

  it('F29: конфигуратор мен раскройдың тікелей аударылатын жолдары сөздікте бар', () => {
    const sources = ['Workspace.tsx', 'CutPage.tsx', 'Configurator.tsx']
    const keys = new Set<string>(['Файл', 'Правка', 'Вид', 'Элемент', 'Инструменты', 'Справка'])
    for (const source of sources) {
      const code = readFileSync(new URL(`../components/${source}`, import.meta.url), 'utf8')
      for (const match of code.matchAll(/\btr\((['"])(.*?)\1\)/g)) keys.add(match[2]!)
    }
    for (const [name, dict] of Object.entries(dicts)) {
      const missing = [...keys].filter((key) => dict[key] === undefined).sort()
      expect(missing, name).toEqual([])
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
