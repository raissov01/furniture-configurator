import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'password-reset-'))

let auth: typeof import('../lib/server/auth')
let reset: typeof import('../lib/server/passwordReset')
let db: typeof import('../lib/server/db')
let rate: typeof import('../lib/server/rateLimit')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  reset = await import('../lib/server/passwordReset')
  db = await import('../lib/server/db')
  rate = await import('../lib/server/rateLimit')
})

describe('құпия сөзді қалпына келтіру', () => {
  it('30 минуттан соң токен бітеді және оны қайта қолдануға болмайды', () => {
    const a = auth.register('reset-expire@example.com', 'original123', 'A')
    if (!a.ok) throw new Error('register failed')
    const issued = reset.issuePasswordReset('reset-expire@example.com', 1000)
    expect(issued).not.toBeNull()
    if (!issued) return
    expect(reset.consumePasswordReset(issued.token, 'replacement123', 1000 + 30 * 60_000)).toBe(false)
    expect(reset.consumePasswordReset(issued.token, 'replacement123', 1000 + 30 * 60_000 - 1)).toBe(true)
    expect(reset.consumePasswordReset(issued.token, 'third-password', 1001)).toBe(false)
    expect(auth.accountFromToken(a.token)).toBeNull()
    expect(auth.login(a.account.email, 'original123').ok).toBe(false)
    expect(auth.login(a.account.email, 'replacement123').ok).toBe(true)
    const raw = db.db().prepare('SELECT token_hash FROM password_resets WHERE user_id = ?').get(a.account.userId) as { token_hash: string }
    expect(raw.token_hash).not.toBe(issued.token)
  })

  it('басқа аккаунттың токені мен бөтен цех қызметкері араласпайды', () => {
    const a = auth.register('reset-a@example.com', 'original123', 'A')
    const b = auth.register('reset-b@example.com', 'original123', 'B')
    if (!a.ok || !b.ok) throw new Error('register failed')
    const member = auth.register('reset-member@example.com', 'original123', '', a.account.shopId)
    if (!member.ok) throw new Error('member register failed')
    expect(reset.issueMemberPasswordReset(b.account.shopId, member.account.userId)).toBeNull()
    const issued = reset.issueMemberPasswordReset(a.account.shopId, member.account.userId, a.account.userId)
    expect(issued?.email).toBe(member.account.email)
    if (!issued) return
    expect(reset.consumePasswordReset(issued.token, 'replacement123')).toBe(true)
    expect(auth.login(b.account.email, 'original123').ok).toBe(true)
    expect(auth.login(b.account.email, 'replacement123').ok).toBe(false)
  })

  it('қысқа құпия сөз деректі өзгертпейді', () => {
    const a = auth.register('reset-short@example.com', 'original123', 'A')
    if (!a.ok) throw new Error('register failed')
    const issued = reset.issuePasswordReset(a.account.email)
    if (!issued) throw new Error('issue failed')
    expect(reset.consumePasswordReset(issued.token, 'short')).toBe(false)
    expect(reset.consumePasswordReset(issued.token, 'replacement123')).toBe(true)
  })

  it('бір аккаунтқа бір сағатта үш қана сұраныс жібереді', () => {
    for (let i = 0; i < 3; i++) expect(rate.allowPasswordResetRequest('192.0.2.1', 'limit@example.com', 1_000)).toBe(true)
    expect(rate.allowPasswordResetRequest('192.0.2.1', 'limit@example.com', 1_000)).toBe(false)
    expect(rate.allowPasswordResetRequest('192.0.2.2', 'limit@example.com', 1_000)).toBe(false)
    expect(rate.allowPasswordResetRequest('192.0.2.1', 'limit@example.com', 3_600_000)).toBe(true)
  })
})
