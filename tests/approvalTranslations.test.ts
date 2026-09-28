import { describe, expect, it } from 'vitest'
import { en } from '../lib/locales/en'
import { uz } from '../lib/locales/uz'

const keys = [
  'Согласование версии', 'Мастер ещё не отправил версию на согласование.',
  'Проверяем версию…', 'Код подтверждения', 'Подтверждаю эту версию',
  'Версия согласована', 'Проект изменился. Попросите новую версию.',
  'Подключитесь к сети, чтобы продолжить.', 'Скачать PDF с печатью',
]

describe('/view келісу мәтіні', () => {
  it.each([['en', en], ['uz', uz]] as const)('%s тілінде орысша қалмайды', (_, dictionary) => {
    for (const key of keys) expect(dictionary[key], key).toBeTruthy()
    for (const key of keys) expect(dictionary[key], key).not.toBe(key)
  })
})
