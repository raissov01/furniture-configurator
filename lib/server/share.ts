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
export function createShare(json: string, now = Date.now(), shopId?: string): ShareCreated {
  const database = db()
  // Пікір жазылған ЦЕХ share-і кейін де дизайнер inbox-ында сақталады.
  // Аноним share-дің inbox-ы жоқ: оны қалдырсақ, кез келген адам share + бір
  // пікірмен кодтар мен дискіні мәңгіге толтырар еді. Архивке жоба JSON-ы
  // керек емес (оны мерзімі өткен соң ешкім оқымайды) — тек пікірлер.
  database.prepare(`DELETE FROM shares WHERE expires_at <= ? AND (shop_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM comments WHERE comments.code = shares.code))`).run(now)
  database.prepare("UPDATE shares SET json = '{}' WHERE expires_at <= ? AND json <> '{}'").run(now)
  const key = randomBytes(24).toString('hex')
  const expiresAt = now + SHARE_TTL_MS
  // Бірегей шектеу екі API репликасы бір кодты таңдаса да тек біреуін өткізеді.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const result = database
      .prepare(`INSERT INTO shares (code, key, json, created_at, updated_at, expires_at, shop_id)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING`)
      .run(code, key, json, now, now, expiresAt, shopId ?? null)
    if (result.changes) return { code, key, expiresAt }
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
export function updateShare(code: string, key: string, json: string, now = Date.now(), shopId?: string): boolean {
  if (!CODE_RE.test(code)) return false
  if (!shopId && !key) return false
  const result = shopId
    ? db().prepare('UPDATE shares SET json = ?, updated_at = ? WHERE code = ? AND shop_id = ? AND expires_at > ?')
      .run(json, now, code, shopId, now)
    : db().prepare('UPDATE shares SET json = ?, updated_at = ? WHERE code = ? AND key = ? AND shop_id IS NULL AND expires_at > ?')
      .run(json, now, code, key, now)
  return Number(result.changes) > 0
}

/** Тек аноним share-дің авторлық кілті. Цех share-і сессия/рөлмен қорғалады. */
export function ownsShareKey(code: string, key: string): boolean {
  if (!CODE_RE.test(code) || !/^[0-9a-f]{48}$/.test(key)) return false
  return Boolean(db().prepare('SELECT 1 FROM shares WHERE code = ? AND key = ? AND shop_id IS NULL AND expires_at > ?').get(code, key, Date.now()))
}

export function shareShopId(code: string): string | null | undefined {
  if (!CODE_RE.test(code)) return undefined
  const row = db().prepare('SELECT shop_id FROM shares WHERE code = ? AND expires_at > ?')
    .get(code, Date.now()) as { shop_id: string | null } | undefined
  return row?.shop_id
}
