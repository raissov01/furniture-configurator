import { createHash, randomBytes } from 'node:crypto'
import { db } from './db'
import { hashPassword, MIN_PASSWORD } from './auth'
import { audit } from './observability'

/** Бір сілтеменің жарамдылығы: 30 минут. */
export const PASSWORD_RESET_TTL_MS = 30 * 60_000
export type IssuedReset = { token: string; email: string }

const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex')

function issue(user: { id: string; email: string; shop_id: string }, actorId: string | null, now: number): IssuedReset {
  const token = randomBytes(32).toString('hex')
  const database = db()
  database.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(user.id)
  database.prepare('INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), user.id, now, now + PASSWORD_RESET_TTL_MS)
  audit({ shopId: user.shop_id, actorId, action: 'request', entityType: 'password', entityId: user.id }, now)
  return { token, email: user.email }
}

/** Белгісіз email — бірдей сыртқы жауап үшін null. */
export function issuePasswordReset(email: string, now = Date.now()): IssuedReset | null {
  const user = db().prepare('SELECT id, email, shop_id FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as { id: string; email: string; shop_id: string } | undefined
  return user ? issue(user, null, now) : null
}

/** Иесі тек өз цехының мүшесіне сілтеме жібере алады. */
export function issueMemberPasswordReset(shopId: string, userId: string, actorId: string | null = null, now = Date.now()): IssuedReset | null {
  const user = db().prepare('SELECT id, email, shop_id FROM users WHERE id = ? AND shop_id = ? AND role <> ?')
    .get(userId, shopId, 'owner') as { id: string; email: string; shop_id: string } | undefined
  return user ? issue(user, actorId, now) : null
}

/** Бір транзакция токенді жұтады, құпиясөзді ауыстырады және барлық сеансты жояды. */
export function consumePasswordReset(token: string, password: string, now = Date.now()): boolean {
  if (!/^[a-f0-9]{64}$/.test(token) || password.length < MIN_PASSWORD || password.length > 1024) return false
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const row = database.prepare(`SELECT r.user_id, r.expires_at, r.used_at, u.shop_id
      FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ?`)
      .get(tokenHash(token)) as { user_id: string; expires_at: number; used_at: number | null; shop_id: string } | undefined
    if (!row || row.used_at !== null || row.expires_at <= now) {
      database.exec('COMMIT')
      return false
    }
    database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id)
    database.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(now, row.user_id)
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id)
    audit({ shopId: row.shop_id, actorId: row.user_id, action: 'reset', entityType: 'password', entityId: row.user_id }, now)
    database.exec('COMMIT')
    return true
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}
