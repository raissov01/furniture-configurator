/**
 * Командаға шақыру.
 *
 * Қауіпсіздіктің өзегі: шақыру — ҚҰПИЯ СІЛТЕМЕ, оны білген адам цехтың
 * бүкіл дерегін көреді. Сондықтан ол бір реттік, мерзімі бар, қайтарып
 * алуға келеді, әрі лимит ЕКІ РЕТ тексеріледі.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-team-'))

let auth: typeof import('../lib/server/auth')
let team: typeof import('../lib/server/team')
let store: typeof import('../lib/server/store')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  team = await import('../lib/server/team')
  store = await import('../lib/server/store')
})

const owner = (email: string) => {
  const r = auth.register(email, 'password123', 'Цех «Алаш»')
  if (!r.ok) throw new Error(r.error)
  return r.account
}

describe('шақыру', () => {
  it('жасалады әрі жарамды болады', () => {
    const a = owner('team-1@example.kz')
    const invite = team.createInvite(a.shopId, a.userId)
    expect(invite.token).toHaveLength(64)
    const check = team.checkInvite(invite.token)
    expect(check.ok).toBe(true)
    if (check.ok) expect(check.shopId).toBe(a.shopId)
  })

  it('шақырумен келген адам ЖАҢА цех ашпайды, барына қосылады', () => {
    const a = owner('team-2@example.kz')
    store.writeProject(a.shopId, 'Ортақ жоба', { any: 1 })
    const invite = team.createInvite(a.shopId, a.userId)

    const joined = auth.register('worker-2@example.kz', 'password123', 'Керек емес ат', a.shopId)
    expect(joined.ok).toBe(true)
    if (!joined.ok) return
    expect(joined.account.shopId).toBe(a.shopId)
    // Цехтың аты шақырушынікі болып қалады, «Керек емес ат» ЕЛЕНБЕЙДІ.
    expect(joined.account.shopName).toBe('Цех «Алаш»')
    // Жоба екеуіне де ортақ.
    expect(store.listProjects(joined.account.shopId)).toHaveLength(1)

    team.markInviteUsed(invite.token, joined.account.userId)
    expect(team.checkInvite(invite.token).ok).toBe(false)
  })

  it('БІР РЕТТІК: қабылданған шақыру екінші рет жүрмейді', () => {
    const a = owner('team-3@example.kz')
    const invite = team.createInvite(a.shopId, a.userId)
    const first = auth.register('worker-3@example.kz', 'password123', '', a.shopId)
    if (!first.ok) throw new Error(first.error)
    team.markInviteUsed(invite.token, first.account.userId)

    const check = team.checkInvite(invite.token)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.error).toMatch(/использовано/)
  })

  it('МЕРЗІМІ өткен шақыру жүрмейді', () => {
    const a = owner('team-4@example.kz')
    const invite = team.createInvite(a.shopId, a.userId, Date.now() - 30 * 86_400_000)
    const check = team.checkInvite(invite.token)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.error).toMatch(/истёк/)
  })

  it('ҚАЙТАРЫП АЛЫНҒАН шақыру жүрмейді', () => {
    const a = owner('team-5@example.kz')
    const invite = team.createInvite(a.shopId, a.userId)
    team.revokeInvite(a.shopId, invite.token)
    const check = team.checkInvite(invite.token)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.error).toMatch(/отозвано/)
  })

  it('БАСҚА ЦЕХ бөтен шақыруды қайтарып ала алмайды', () => {
    const a = owner('team-6@example.kz')
    const b = owner('team-7@example.kz')
    const invite = team.createInvite(a.shopId, a.userId)
    team.revokeInvite(b.shopId, invite.token) // бөтен цехтың әрекеті
    expect(team.checkInvite(invite.token).ok).toBe(true)
  })

  it('жоқ токен — «табылмады»', () => {
    const check = team.checkInvite('жоқ'.repeat(10))
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.error).toMatch(/не найдено/)
  })
})

describe('команданың тізімі', () => {
  it('цехтағы адамдар қосылу ретімен көрінеді', () => {
    const a = owner('team-8@example.kz')
    auth.register('worker-8a@example.kz', 'password123', '', a.shopId)
    auth.register('worker-8b@example.kz', 'password123', '', a.shopId)
    const members = team.listMembers(a.shopId)
    expect(members.map((m) => m.email)).toEqual([
      'team-8@example.kz', 'worker-8a@example.kz', 'worker-8b@example.kz',
    ])
  })

  it('бір цехтың командасы екіншісіне КӨРІНБЕЙДІ', () => {
    const a = owner('team-9@example.kz')
    const b = owner('team-10@example.kz')
    auth.register('worker-9@example.kz', 'password123', '', a.shopId)
    expect(team.listMembers(b.shopId).map((m) => m.email)).toEqual(['team-10@example.kz'])
  })

  it('шақырулар тізімінде күйі көрінеді', () => {
    const a = owner('team-11@example.kz')
    const open = team.createInvite(a.shopId, a.userId)
    const revoked = team.createInvite(a.shopId, a.userId)
    team.revokeInvite(a.shopId, revoked.token)

    const rows = team.listInvites(a.shopId)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.token === open.token)!.revoked).toBe(false)
    expect(rows.find((r) => r.token === revoked.token)!.revoked).toBe(true)
  })
})
