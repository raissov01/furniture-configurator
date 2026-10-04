import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'

const disclosure = 'Замеры и фотографии сохраняются на устройстве без сети. Когда открывается полная онлайн-версия и выполнен вход в аккаунт мастерской, ожидающие отправки данные автоматически синхронизируются с сервером. До отправки очередь хранится на устройстве.'
it('discloses the hybrid offline-to-online upload and has translated text', () => {
  const page = readFileSync(new URL('../app/privacy/page.tsx', import.meta.url), 'utf8')
  expect(page).toContain(disclosure)
  expect(page).not.toContain('Мобильная офлайн-оболочка сейчас не отправляет замеры автоматически')
  for (const locale of [en, kk, uz]) {
    expect(locale[disclosure]).toBeTruthy()
    expect(locale[disclosure]).not.toBe(disclosure)
  }
})
