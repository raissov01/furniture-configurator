/**
 * Цехтың командасы: шақыру, тізім, шақыруды қайтарып алу, адамды шығару.
 *
 * Әр мүше рөлі SQLite ішінде сақталады. Клиент аккаунттары цех мүшесі емес:
 * олар уақытша share code арқылы ғана жария көрініске кіреді.
 *
 * ⚠ ШАҚЫРУ — ҚҰПИЯ СІЛТЕМЕ. Токенді білген адам цехқа кіре алады, сондықтан
 * ол бір реттік, мерзімі бар әрі қайтарып алуға келеді.
 */

import { randomBytes } from 'node:crypto'
import { db } from './db'
import { audit } from './observability'
import type { Role } from '../permissions'

/** Шақыру осынша күн жарамды. Ұзағы — ұмытылып қалған ашық есік. */
export const INVITE_DAYS = 7

export type Member = { userId: string; email: string; joinedAt: number; role: Role }

export type Invite = {
  token: string
  createdAt: number
  expiresAt: number
  /** Қабылданған болса — кімнің поштасы */
  usedBy: string | null
  revoked: boolean
  role: Extract<Role, 'designer' | 'shop'>
}

export function listMembers(shopId: string): Member[] {
  const rows = db()
    .prepare('SELECT id, email, created_at, role FROM users WHERE shop_id = ? ORDER BY created_at')
    .all(shopId) as { id: string; email: string; created_at: number; role: Role }[]
  return rows.map((r) => ({ userId: r.id, email: r.email, joinedAt: r.created_at, role: r.role }))
}

export function createInvite(shopId: string, userId: string, now = Date.now(), role: Extract<Role, 'designer' | 'shop'> = 'designer'): Invite {
  const token = randomBytes(32).toString('hex')
  const expiresAt = now + INVITE_DAYS * 86_400_000
  db()
    .prepare('INSERT INTO invites (token, shop_id, created_by, created_at, expires_at, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(token, shopId, userId, now, expiresAt, role)
  return { token, createdAt: now, expiresAt, usedBy: null, revoked: false, role }
}

export function listInvites(shopId: string): Invite[] {
  const rows = db()
    .prepare(`
      SELECT i.token, i.created_at, i.expires_at, i.revoked_at, i.role, u.email AS used_email
      FROM invites i LEFT JOIN users u ON u.id = i.used_by
      WHERE i.shop_id = ? ORDER BY i.created_at DESC LIMIT 50
    `)
    .all(shopId) as {
      token: string; created_at: number; expires_at: number
      revoked_at: number | null; used_email: string | null; role: Extract<Role, 'designer' | 'shop'>
    }[]
  return rows.map((r) => ({
    token: r.token,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedBy: r.used_email,
    revoked: r.revoked_at !== null,
    role: r.role,
  }))
}

/** Қайтарып алу. Қабылданып қойған шақыруға әсер етпейді — адам цехта қалады. */
export function revokeInvite(shopId: string, token: string, now = Date.now()): void {
  db()
    .prepare('UPDATE invites SET revoked_at = ? WHERE shop_id = ? AND token = ? AND used_by IS NULL')
    .run(now, shopId, token)
}

export type InviteCheck =
  | { ok: true; shopId: string; role: Extract<Role, 'designer' | 'shop'> }
  | { ok: false; error: string }

/**
 * Шақыру жарамды ма. Қате хабарлары ӘРТҮРЛІ: адам не істеу керегін білуі
 * керек («мерзімі бітті» мен «мұндай шақыру жоқ» — екі басқа әрекет).
 */
export function checkInvite(token: string, now = Date.now()): InviteCheck {
  const row = db()
    .prepare('SELECT shop_id, expires_at, used_by, revoked_at, role FROM invites WHERE token = ?')
    .get(token) as
      | { shop_id: string; expires_at: number; used_by: string | null; revoked_at: number | null; role: Extract<Role, 'designer' | 'shop'> }
      | undefined

  if (!row) return { ok: false, error: 'Приглашение не найдено' }
  if (row.used_by !== null) return { ok: false, error: 'Приглашение уже использовано' }
  if (row.revoked_at !== null) return { ok: false, error: 'Приглашение отозвано' }
  if (row.expires_at < now) return { ok: false, error: 'Срок приглашения истёк' }
  return { ok: true, shopId: row.shop_id, role: row.role }
}

export function setMemberRole(shopId: string, targetUserId: string, role: Extract<Role, 'designer' | 'shop'>, actorId?: string): boolean {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const changed = database.prepare("UPDATE users SET role = ? WHERE shop_id = ? AND id = ? AND role <> 'owner'")
      .run(role, shopId, targetUserId)
    if (changed.changes) audit({ shopId, actorId, action: 'set', entityType: 'role', entityId: targetUserId, detail: { role } })
    database.exec('COMMIT')
    return Boolean(changed.changes)
  } catch (cause) { database.exec('ROLLBACK'); throw cause }
}

export function markInviteUsed(token: string, userId: string, now = Date.now()): void {
  db().prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE token = ?').run(userId, now, token)
}

/**
 * Цехтың ИЕСІ — ең бірінші тіркелген адам.
 *
 * Рөл кестесі жоқ (жоғарыдағы ескертпені қара), сондықтан «кім шығара алады»
 * дегенді ретпен шешеміз: цехты ашқан адам — иесі. Бұл ереже дерекке жаңа
 * баған қоспайды әрі ойдан шығарылмаған: цехты ол тіркеген.
 */
export function founderOf(shopId: string): string | null {
  const row = db()
    .prepare('SELECT id FROM users WHERE shop_id = ? ORDER BY created_at, id LIMIT 1')
    .get(shopId) as { id: string } | undefined
  return row?.id ?? null
}

export type RemoveResult = { ok: true } | { ok: false; error: string }

/**
 * Адамды цехтан шығару.
 *
 * Кім шығара алады: цехтың ИЕСІ — кез келгенді, ал қалғаны — тек ӨЗІН
 * («цехтан кету»). Иенің өзін шығаруға болмайды: цех иесіз қалар еді.
 *
 * ⚠ ЕҢ БАСТЫСЫ — ШАҚЫРУ ҚАЙТА АШЫЛЫП КЕТПЕУІ. `invites.used_by` бағаны
 * `ON DELETE SET NULL`, сондықтан адамды өшірген бойда ол КІРГЕН шақыру
 * «әлі қолданылмаған» болып қалады да, сілтемесі сақталған адам цехқа
 * қайта кіре алар еді. Сол себепті алдымен сол шақырулар қайтарып алынады.
 *
 * Жобалар цехтікі (`projects.shop_id`) — адам кеткенде ештеңе жоғалмайды.
 * Сеанстары каскадпен өшеді: шығарылған адам сол сәтте-ақ шығып қалады.
 */
export function removeMember(
  shopId: string, actorUserId: string, targetUserId: string, now = Date.now(),
): RemoveResult {
  const target = db()
    .prepare('SELECT id FROM users WHERE id = ? AND shop_id = ?')
    .get(targetUserId, shopId) as { id: string } | undefined
  if (!target) return { ok: false, error: 'Этот человек не из вашего цеха' }

  const founder = founderOf(shopId)
  if (targetUserId === founder) return { ok: false, error: 'Владельца цеха убрать нельзя' }
  if (actorUserId !== founder && actorUserId !== targetUserId) {
    return { ok: false, error: 'Убирать людей может только владелец цеха' }
  }

  const database = db()
  database.exec('BEGIN')
  try {
    database
      .prepare('UPDATE invites SET revoked_at = ? WHERE used_by = ? AND revoked_at IS NULL')
      .run(now, targetUserId)
    database.prepare('DELETE FROM users WHERE id = ? AND shop_id = ?').run(targetUserId, shopId)
    audit({ shopId, actorId: actorUserId, action: 'remove', entityType: 'role', entityId: targetUserId }, now)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return { ok: true }
}
