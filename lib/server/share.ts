/**
 * КЛИЕНТКЕ КОД — qdesign «3D-көріністе ашу» сияқты (09-13).
 *
 * Олардікі: 6 таңбалы код, 24 сағат жарамды, клиент оны QDesignPreview-ге
 * теріп, жобаны 3D-де көреді; «Автоматты жаңарту» — цех өзгертсе, клиенттің
 * экраны өзі жаңарады. Бізде: код → `/view?c=123456` (не `/c` бетінде теру).
 *
 * Аутентификация ӘДЕЙІ жоқ (AR сияқты): кодты клиенттің телефоны ашады,
 * ол цехтың сеансын білмейді. Қауіпсіздігі — қысқа өмірінде (24 сағат) әрі
 * жоба ТЕК ОҚУҒА: өзгерту үшін кодты жасағанда берілген `key` керек.
 */

import { randomBytes, randomInt } from 'node:crypto'
import { db } from './db'

/** Кодтың өмірі: qdesign-дағыдай 24 сағат. */
export const SHARE_TTL_MS = 24 * 60 * 60 * 1000
/** Жоба JSON-ының шегі, байт: бөтен адам дискіні толтыра алмауы үшін. */
export const SHARE_MAX_BYTES = 2 * 1024 * 1024

const CODE_RE = /^\d{6}$/

export type ShareCreated = { code: string; key: string; expiresAt: number }

/** Жаңа код. Мерзімі өткендер осы жерде тазаланады. */
export function createShare(json: string, now = Date.now()): ShareCreated {
  const database = db()
  database.prepare('DELETE FROM shares WHERE expires_at <= ?').run(now)
  const key = randomBytes(24).toString('hex')
  const expiresAt = now + SHARE_TTL_MS
  // 1 000 000 кодтың ішінде бос біреуін табу: қайталанса — қайта таңдау.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    if (database.prepare('SELECT 1 FROM shares WHERE code = ?').get(code)) continue
    database
      .prepare('INSERT INTO shares (code, key, json, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(code, key, json, now, now, expiresAt)
    return { code, key, expiresAt }
  }
  throw new Error('Не удалось подобрать свободный код — попробуйте ещё раз')
}

/** Жобаны кодпен оқу. Пішімі дұрыс емес, жоқ не мерзімі өткен код — null. */
export function readShare(
  code: string,
  now = Date.now(),
): { json: string; updatedAt: number; expiresAt: number } | null {
  if (!CODE_RE.test(code)) return null
  const row = db().prepare('SELECT json, updated_at, expires_at FROM shares WHERE code = ?').get(code) as
    | { json: string; updated_at: number; expires_at: number }
    | undefined
  if (!row || row.expires_at <= now) return null
  return { json: row.json, updatedAt: row.updated_at, expiresAt: row.expires_at }
}

/** Автоматты жаңарту: тек кодты жасаған (кілті бар) адам өзгерте алады. */
export function updateShare(code: string, key: string, json: string, now = Date.now()): boolean {
  if (!CODE_RE.test(code) || !key) return false
  const result = db()
    .prepare('UPDATE shares SET json = ?, updated_at = ? WHERE code = ? AND key = ? AND expires_at > ?')
    .run(json, now, code, key, now)
  return Number(result.changes) > 0
}
