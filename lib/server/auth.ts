/**
 * Аккаунттар: тіркелу, кіру, сессия.
 *
 * Құпиясөз ЕШҚАШАН ашық сақталмайды: scrypt + кездейсоқ тұз, салыстыру
 * тұрақты уақытпен. Сессия — кездейсоқ 32 байт, httpOnly cookie ішінде;
 * браузердегі JS оны оқи алмайды.
 *
 * Мұнда пошта растау да, құпиясөзді қалпына келтіру де ЖОҚ — олар бөлек
 * жұмыс, ал жоқ нәрсені бар деп көрсетпейміз.
 */

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from './db'

export const SESSION_COOKIE = 'furniture_session'
/** Сессия осынша күн жарамды. */
const SESSION_DAYS = 30
/** Құпиясөздің ең аз ұзындығы. Қысқасы — бұзылған аккаунт. */
export const MIN_PASSWORD = 8

export type Account = {
  userId: string
  email: string
  shopId: string
  shopName: string
}

function hashPassword(password: string): string {
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

export function register(email: string, password: string, shopName: string): AuthResult {
  const clean = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: 'Неверный адрес почты' }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Пароль короче ${MIN_PASSWORD} символов` }
  }

  const database = db()
  const exists = database.prepare('SELECT id FROM users WHERE email = ?').get(clean)
  if (exists) return { ok: false, error: 'Такая почта уже зарегистрирована' }

  const now = Date.now()
  const shopId = randomUUID()
  const userId = randomUUID()
  const name = shopName.trim() || 'Мой цех'

  database.prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(shopId, name, now)
  database
    .prepare('INSERT INTO users (id, email, password_hash, shop_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, clean, hashPassword(password), shopId, now)

  return { ok: true, token: startSession(userId), account: { userId, email: clean, shopId, shopName: name } }
}

export function login(email: string, password: string): AuthResult {
  const clean = email.trim().toLowerCase()
  const row = db()
    .prepare(`
      SELECT u.id, u.email, u.password_hash, u.shop_id, s.name AS shop_name
      FROM users u JOIN shops s ON s.id = u.shop_id
      WHERE u.email = ?
    `)
    .get(clean) as
      | { id: string; email: string; password_hash: string; shop_id: string; shop_name: string }
      | undefined

  // Қате хабары бірдей: пошта тіркелген бе екенін білдіріп алмау үшін.
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: 'Почта или пароль не подходят' }
  }

  return {
    ok: true,
    token: startSession(row.id),
    account: { userId: row.id, email: row.email, shopId: row.shop_id, shopName: row.shop_name },
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
      SELECT u.id, u.email, u.shop_id, s.name AS shop_name, ss.expires_at
      FROM sessions ss
      JOIN users u ON u.id = ss.user_id
      JOIN shops s ON s.id = u.shop_id
      WHERE ss.token = ?
    `)
    .get(token) as
      | { id: string; email: string; shop_id: string; shop_name: string; expires_at: number }
      | undefined

  if (!row) return null
  if (row.expires_at < Date.now()) {
    endSession(token)
    return null
  }
  return { userId: row.id, email: row.email, shopId: row.shop_id, shopName: row.shop_name }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DAYS * 86_400,
}
