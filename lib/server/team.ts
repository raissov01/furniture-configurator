/**
 * Цехтың командасы: шақыру, тізім, шақыруды қайтарып алу.
 *
 * РӨЛ ЖОҚ әрі ӘДЕЙІ жоқ. Цехта екі-үш адам болады да, олардың бәрі бір
 * жобамен жұмыс істейді; «кім кімге не істей алады» деген қабатты бүгін
 * қоссақ, ол пайдасынан гөрі шатағын көбейтер еді. Сондықтан цехтағы кез
 * келген адам шақыра алады, ал шақырылған адам сол цехтың дерегін толық
 * көреді. Рөл керек болса — ол бөлек жұмыс, әрі оны кестені бұзбай қосуға
 * болады (`users` кестесіне баған).
 *
 * ⚠ ШАҚЫРУ — ҚҰПИЯ СІЛТЕМЕ. Токенді білген адам цехқа кіре алады, сондықтан
 * ол бір реттік, мерзімі бар әрі қайтарып алуға келеді.
 */

import { randomBytes } from 'node:crypto'
import { db } from './db'

/** Шақыру осынша күн жарамды. Ұзағы — ұмытылып қалған ашық есік. */
export const INVITE_DAYS = 7

export type Member = { userId: string; email: string; joinedAt: number }

export type Invite = {
  token: string
  createdAt: number
  expiresAt: number
  /** Қабылданған болса — кімнің поштасы */
  usedBy: string | null
  revoked: boolean
}

export function listMembers(shopId: string): Member[] {
  const rows = db()
    .prepare('SELECT id, email, created_at FROM users WHERE shop_id = ? ORDER BY created_at')
    .all(shopId) as { id: string; email: string; created_at: number }[]
  return rows.map((r) => ({ userId: r.id, email: r.email, joinedAt: r.created_at }))
}

export function createInvite(shopId: string, userId: string, now = Date.now()): Invite {
  const token = randomBytes(32).toString('hex')
  const expiresAt = now + INVITE_DAYS * 86_400_000
  db()
    .prepare('INSERT INTO invites (token, shop_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, shopId, userId, now, expiresAt)
  return { token, createdAt: now, expiresAt, usedBy: null, revoked: false }
}

export function listInvites(shopId: string): Invite[] {
  const rows = db()
    .prepare(`
      SELECT i.token, i.created_at, i.expires_at, i.revoked_at, u.email AS used_email
      FROM invites i LEFT JOIN users u ON u.id = i.used_by
      WHERE i.shop_id = ? ORDER BY i.created_at DESC LIMIT 50
    `)
    .all(shopId) as {
      token: string; created_at: number; expires_at: number
      revoked_at: number | null; used_email: string | null
    }[]
  return rows.map((r) => ({
    token: r.token,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedBy: r.used_email,
    revoked: r.revoked_at !== null,
  }))
}

/** Қайтарып алу. Қабылданып қойған шақыруға әсер етпейді — адам цехта қалады. */
export function revokeInvite(shopId: string, token: string, now = Date.now()): void {
  db()
    .prepare('UPDATE invites SET revoked_at = ? WHERE shop_id = ? AND token = ? AND used_by IS NULL')
    .run(now, shopId, token)
}

export type InviteCheck =
  | { ok: true; shopId: string }
  | { ok: false; error: string }

/**
 * Шақыру жарамды ма. Қате хабарлары ӘРТҮРЛІ: адам не істеу керегін білуі
 * керек («мерзімі бітті» мен «мұндай шақыру жоқ» — екі басқа әрекет).
 */
export function checkInvite(token: string, now = Date.now()): InviteCheck {
  const row = db()
    .prepare('SELECT shop_id, expires_at, used_by, revoked_at FROM invites WHERE token = ?')
    .get(token) as
      | { shop_id: string; expires_at: number; used_by: string | null; revoked_at: number | null }
      | undefined

  if (!row) return { ok: false, error: 'Приглашение не найдено' }
  if (row.used_by !== null) return { ok: false, error: 'Приглашение уже использовано' }
  if (row.revoked_at !== null) return { ok: false, error: 'Приглашение отозвано' }
  if (row.expires_at < now) return { ok: false, error: 'Срок приглашения истёк' }
  return { ok: true, shopId: row.shop_id }
}

export function markInviteUsed(token: string, userId: string, now = Date.now()): void {
  db().prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE token = ?').run(userId, now, token)
}
