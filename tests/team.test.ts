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

/**
 * Адамды цехтан шығару.
 *
 * Ең қауіпті тұсы — ШАҚЫРУДЫҢ ҚАЙТА АШЫЛУЫ: адам өшкенде `invites.used_by`
 * NULL болады да, ол кірген сілтеме қайтадан жарамды көрінер еді. Сол
 * себепті сілтеме шығару кезінде қайтарып алынады.
 */
describe('цехтан шығару', () => {
  const joined = (shopId: string, email: string) => {
    const r = auth.register(email, 'password123', '', shopId)
    if (!r.ok) throw new Error(r.error)
    return r.account
  }

  it('иесі басқа адамды шығарады, жобалар цехта қалады', () => {
    const a = owner('team-12@example.kz')
    const worker = joined(a.shopId, 'worker-12@example.kz')
    store.writeProject(a.shopId, 'Ортақ жоба', { any: 1 })

    expect(team.removeMember(a.shopId, a.userId, worker.userId).ok).toBe(true)
    expect(team.listMembers(a.shopId).map((m) => m.email)).toEqual(['team-12@example.kz'])
    expect(store.listProjects(a.shopId)).toHaveLength(1)
  })

  it('ШЫҒАРЫЛҒАН адамның сеансы сол сәтте жарамсыз', () => {
    const a = owner('team-13@example.kz')
    const r = auth.register('worker-13@example.kz', 'password123', '', a.shopId)
    if (!r.ok) throw new Error(r.error)
    expect(auth.accountFromToken(r.token)?.email).toBe('worker-13@example.kz')

    team.removeMember(a.shopId, a.userId, r.account.userId)
    expect(auth.accountFromToken(r.token)).toBe(null)
  })

  it('ШАҚЫРУ ҚАЙТА АШЫЛМАЙДЫ: адам кеткен соң сілтеме жарамсыз', () => {
    const a = owner('team-14@example.kz')
    const invite = team.createInvite(a.shopId, a.userId)
    const worker = joined(a.shopId, 'worker-14@example.kz')
    team.markInviteUsed(invite.token, worker.userId)

    team.removeMember(a.shopId, a.userId, worker.userId)
    const check = team.checkInvite(invite.token)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.error).toMatch(/отозвано/)
  })

  it('ИЕСІН шығаруға болмайды — цех иесіз қалар еді', () => {
    const a = owner('team-15@example.kz')
    const worker = joined(a.shopId, 'worker-15@example.kz')
    const result = team.removeMember(a.shopId, worker.userId, a.userId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/[Вв]ладельца/)
    expect(team.listMembers(a.shopId)).toHaveLength(2)
  })

  it('қатардағы адам БАСҚАНЫ шығара алмайды, ӨЗІ кете алады', () => {
    const a = owner('team-16@example.kz')
    const one = joined(a.shopId, 'worker-16a@example.kz')
    const two = joined(a.shopId, 'worker-16b@example.kz')

    const denied = team.removeMember(a.shopId, one.userId, two.userId)
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.error).toMatch(/владелец/)

    expect(team.removeMember(a.shopId, one.userId, one.userId).ok).toBe(true)
    expect(team.listMembers(a.shopId).map((m) => m.email)).toEqual([
      'team-16@example.kz', 'worker-16b@example.kz',
    ])
  })

  it('БӨТЕН ЦЕХТЫҢ адамына тиісе алмайды', () => {
    const a = owner('team-17@example.kz')
    const b = owner('team-18@example.kz')
    const worker = joined(b.shopId, 'worker-18@example.kz')

    const result = team.removeMember(a.shopId, a.userId, worker.userId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/не из вашего цеха/)
    expect(team.listMembers(b.shopId)).toHaveLength(2)
  })

  it('иесі — ең бірінші тіркелген адам', () => {
    const a = owner('team-19@example.kz')
    joined(a.shopId, 'worker-19@example.kz')
    expect(team.founderOf(a.shopId)).toBe(a.userId)
  })
})
