/**
 * Аккаунттар: құпиясөз, сессия, цехтың дерегін бөлу.
 *
 * Ең маңыздысы — БІР ЦЕХТЫҢ ДЕРЕГІ ЕКІНШІСІНЕ КӨРІНБЕУІ. Сұраныс әрқашан
 * сессиядан алынған shop_id-мен шектеледі, клиенттен келген id-мен емес;
 * мына тестер соны шынымен солай екенін тексереді.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// Дерекқор жолы модуль жүктелгенде оқылады — сондықтан импорттан БҰРЫН.
process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-test-'))

let auth: typeof import('../lib/server/auth')
let store: typeof import('../lib/server/store')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  store = await import('../lib/server/store')
})

describe('тіркелу', () => {
  it('дұрыс дерекпен цех пен аккаунт жасалады', () => {
    const r = auth.register('shop@example.kz', 'password123', 'Цех «Алаш»')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.account.email).toBe('shop@example.kz')
    expect(r.account.shopName).toBe('Цех «Алаш»')
    expect(r.token).toHaveLength(64)
  })

  it('бір пошта екі рет тіркелмейді', () => {
    auth.register('dup@example.kz', 'password123', 'Первый')
    const again = auth.register('dup@example.kz', 'password123', 'Второй')
    expect(again.ok).toBe(false)
  })

  it('қысқа құпиясөз қабылданбайды', () => {
    const r = auth.register('short@example.kz', '1234', 'Цех')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Пароль/)
  })

  it('бұрыс пошта қабылданбайды', () => {
    expect(auth.register('не-почта', 'password123', 'Цех').ok).toBe(false)
  })
})

describe('кіру', () => {
  beforeAll(() => {
    auth.register('login@example.kz', 'password123', 'Цех входа')
  })

  it('дұрыс құпиясөзбен кіреді', () => {
    expect(auth.login('login@example.kz', 'password123').ok).toBe(true)
  })

  it('бұрыс құпиясөзбен кірмейді', () => {
    expect(auth.login('login@example.kz', 'wrong-password').ok).toBe(false)
  })

  it('жоқ пошта мен бұрыс құпиясөздің қатесі БІРДЕЙ — пошта бар-жоғы білінбейді', () => {
    const missing = auth.login('nobody@example.kz', 'password123')
    const wrong = auth.login('login@example.kz', 'nope-nope-nope')
    expect(missing.ok).toBe(false)
    expect(wrong.ok).toBe(false)
    if (!missing.ok && !wrong.ok) expect(missing.error).toBe(wrong.error)
  })

  it('құпиясөз АШЫҚ сақталмайды', () => {
    const r = auth.login('login@example.kz', 'password123')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const account = auth.accountFromToken(r.token)
    expect(JSON.stringify(account)).not.toContain('password123')
  })
})

describe('сессия', () => {
  it('токен аккаунтқа апарады, шыққаннан кейін жарамсыз', () => {
    const r = auth.register('session@example.kz', 'password123', 'Цех сессии')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(auth.accountFromToken(r.token)?.email).toBe('session@example.kz')
    auth.endSession(r.token)
    expect(auth.accountFromToken(r.token)).toBeNull()
  })

  it('жоқ токен ешқашан аккаунт бермейді', () => {
    expect(auth.accountFromToken(undefined)).toBeNull()
    expect(auth.accountFromToken('0'.repeat(64))).toBeNull()
  })
})

describe('цехтар бір-бірінің дерегін КӨРМЕЙДІ', () => {
  it('жоба тек өз цехына көрінеді', () => {
    const a = auth.register('a@example.kz', 'password123', 'Цех А')
    const b = auth.register('b@example.kz', 'password123', 'Цех Б')
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    const id = store.writeProject(a.account.shopId, 'Шкаф А', { schemaVersion: 3, name: 'Шкаф А' })

    expect(store.readProject(a.account.shopId, id)).not.toBeNull()
    // Б цехы id-ді білсе де оқи алмайды.
    expect(store.readProject(b.account.shopId, id)).toBeNull()
    expect(store.listProjects(b.account.shopId)).toEqual([])
  })

  it('профиль де цехқа байланады', () => {
    const a = auth.register('pa@example.kz', 'password123', 'Профиль А')
    const b = auth.register('pb@example.kz', 'password123', 'Профиль Б')
    if (!a.ok || !b.ok) return
    store.writeShopProfile(a.account.shopId, { marker: 'A' })
    expect(store.readShopProfile(a.account.shopId)).toEqual({ marker: 'A' })
    expect(store.readShopProfile(b.account.shopId)).toBeNull()
  })

  it('бөтен жобаны өшіруге болмайды', () => {
    const a = auth.register('da@example.kz', 'password123', 'Удаление А')
    const b = auth.register('db@example.kz', 'password123', 'Удаление Б')
    if (!a.ok || !b.ok) return
    const id = store.writeProject(a.account.shopId, 'Свой', { schemaVersion: 3 })
    store.deleteProject(b.account.shopId, id)
    expect(store.readProject(a.account.shopId, id)).not.toBeNull()
  })
})
