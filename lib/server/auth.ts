/**
 * Аккаунттар: тіркелу, кіру, сессия.
 *
 * Құпиясөз ЕШҚАШАН ашық сақталмайды: scrypt + кездейсоқ тұз, салыстыру
 * тұрақты уақытпен. Сессия — кездейсоқ 32 байт, httpOnly cookie ішінде;
 * браузердегі JS оны оқи алмайды.
 *
 * Құпиясөзді қалпына келтіру токендері passwordReset модулінде.
 */

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from './db'
import type { Role } from '../permissions'
import { MAX_SHOP_NAME_LENGTH, MIN_ACCOUNT_PASSWORD_LENGTH } from '../accountPanelState'

export const SESSION_COOKIE = 'furniture_session'
/** Сессия осынша күн жарамды. */
const SESSION_DAYS = 30
/** Құпиясөздің ең аз ұзындығы. Қысқасы — бұзылған аккаунт. */
export const MIN_PASSWORD = MIN_ACCOUNT_PASSWORD_LENGTH
/** Цех атауының ең ұзын көрінетін мәтіні; сақтау мен UI енгізу шегі. */
export { MAX_SHOP_NAME_LENGTH }

export type Account = {
  userId: string
  email: string
  shopId: string
  shopName: string
  role: Role
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, expectedHex] = stored.split(':')
  if (!saltHex || !expectedHex) return false
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(expectedHex, 'hex')
  // Ұзындығы әртүрлі болса timingSafeEqual лақтырады — алдын ала тексереміз.
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export type AuthResult = { ok: true; token: string; account: Account } | { ok: false; error: string }

/**
 * Тіркелу.
 *
 * `invite` берілсе, адам ЖАҢА цех ашпайды, БАР цехқа қосылады: жобалар да,
 * профиль де ортақ болады. Шақырудың жарамдылығын шақырушы жағы тексереді
 * (`checkInvite`), ал мұнда тек цехтың id-і келеді — auth қабаты шақырудың
 * ережелерін білмеуі керек.
 */
export function register(
  email: string,
  password: string,
  shopName: string,
  joinShopId?: string,
  joinRole: Extract<Role, 'designer' | 'shop'> = 'designer',
): AuthResult {
  const clean = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: 'Неверный адрес почты' }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Пароль короче ${MIN_PASSWORD} символов` }
  }
  if (!joinShopId && shopName.trim().length > MAX_SHOP_NAME_LENGTH) {
    return { ok: false, error: `Название цеха длиннее ${MAX_SHOP_NAME_LENGTH} символов` }
  }

  const database = db()
  const exists = database.prepare('SELECT id FROM users WHERE email = ?').get(clean)
  if (exists) return { ok: false, error: 'Такая почта уже зарегистрирована' }

  const now = Date.now()
  const userId = randomUUID()

  let shopId: string
  let name: string
  if (joinShopId) {
    const shop = database.prepare('SELECT id, name FROM shops WHERE id = ?').get(joinShopId) as
      | { id: string; name: string }
      | undefined
    if (!shop) return { ok: false, error: 'Цех приглашения не найден' }
    shopId = shop.id
    name = shop.name
  } else {
    shopId = randomUUID()
    name = shopName.trim() || 'Мой цех'
    database.prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(shopId, name, now)
  }

  database
    .prepare('INSERT INTO users (id, email, password_hash, shop_id, created_at, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, clean, hashPassword(password), shopId, now, joinShopId ? joinRole : 'owner')

  return { ok: true, token: startSession(userId), account: { userId, email: clean, shopId, shopName: name, role: joinShopId ? joinRole : 'owner' } }
}

export function login(email: string, password: string): AuthResult {
  const clean = email.trim().toLowerCase()
  const row = db()
    .prepare(`
      SELECT u.id, u.email, u.password_hash, u.shop_id, u.role, s.name AS shop_name
      FROM users u JOIN shops s ON s.id = u.shop_id
      WHERE u.email = ?
    `)
    .get(clean) as
      | { id: string; email: string; password_hash: string; shop_id: string; shop_name: string; role: Role }
      | undefined

  // Қате хабары бірдей: пошта тіркелген бе екенін білдіріп алмау үшін.
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: 'Почта или пароль не подходят' }
  }

  return {
    ok: true,
    token: startSession(row.id),
    account: { userId: row.id, email: row.email, shopId: row.shop_id, shopName: row.shop_name, role: row.role },
  }
}

function startSession(userId: string): string {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  db()
    .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, now, now + SESSION_DAYS * 86_400_000)
  return token
}

export function endSession(token: string): void {
  db().prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

/** Cookie-дегі токен бойынша аккаунт. Мерзімі өткен сессия жарамсыз. */
export function accountFromToken(token: string | undefined): Account | null {
  if (!token) return null
  const row = db()
    .prepare(`
      SELECT u.id, u.email, u.shop_id, u.role, s.name AS shop_name, ss.expires_at
      FROM sessions ss
      JOIN users u ON u.id = ss.user_id
      JOIN shops s ON s.id = u.shop_id
      WHERE ss.token = ?
    `)
    .get(token) as
      | { id: string; email: string; shop_id: string; shop_name: string; role: Role; expires_at: number }
      | undefined

  if (!row) return null
  if (row.expires_at < Date.now()) {
    endSession(token)
    return null
  }
  return { userId: row.id, email: row.email, shopId: row.shop_id, shopName: row.shop_name, role: row.role }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DAYS * 86_400,
}
