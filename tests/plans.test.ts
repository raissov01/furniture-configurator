/**
 * Тарифтер.
 *
 * Ең маңызды екі ереже мұнда күзетіледі:
 *   1. БАР ЖОБАНЫ ЖАҢАРТУ ешқашан бөгелмейді — ол цехтың өз еңбегі;
 *   2. мерзімі өткен тариф аккаунтты ЖАБЫҚПАЙДЫ, тек тегін шектерге түседі.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { PLANS, canAddMember, canAddProject, planOf, planPrice } from '../lib/plans'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-plan-'))

let auth: typeof import('../lib/server/auth')
let store: typeof import('../lib/server/store')
let plan: typeof import('../lib/server/plan')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  store = await import('../lib/server/store')
  plan = await import('../lib/server/plan')
})

describe('жоспарлар кестесі', () => {
  it('әдепкі — сынақ жоспары, ал белгісіз ат та соған түседі', () => {
    expect(planOf(undefined).id).toBe('free')
    expect(planOf('жоқ-тариф').id).toBe('free')
    expect(planOf('team').id).toBe('team')
  })

  it('БАҒА кодта ЖОҚ: қойылмаса — «келісіледі»', () => {
    expect(planPrice('shop', {})).toBeNull()
    expect(planPrice('shop', { PLAN_PRICE_SHOP: '1990000' })).toBe(1990000)
    // Мағынасыз мән баға болып саналмайды — нөл деп көрсетуден жақсы.
    expect(planPrice('shop', { PLAN_PRICE_SHOP: 'бір миллион' })).toBeNull()
  })

  it('сынақта жоба шектеулі, «командада» шексіз', () => {
    expect(canAddProject(PLANS.free, { projects: 2, members: 1 }).ok).toBe(true)
    expect(canAddProject(PLANS.free, { projects: 3, members: 1 }).ok).toBe(false)
    expect(canAddProject(PLANS.team, { projects: 5000, members: 1 }).ok).toBe(true)
  })

  it('шек біткенде себебі АЙТЫЛАДЫ әрі жобаның жоғалмайтыны жазылады', () => {
    const check = canAddProject(PLANS.free, { projects: 3, members: 1 })
    expect(check.ok).toBe(false)
    if (check.ok) return
    expect(check.reason).toMatch(/жоғалмайды/)
  })

  it('аккаунт саны да шектеледі', () => {
    expect(canAddMember(PLANS.shop, { projects: 0, members: 3 }).ok).toBe(false)
    expect(canAddMember(PLANS.team, { projects: 0, members: 99 }).ok).toBe(true)
  })
})

describe('цехтың тарифі (дерекқор)', () => {
  const shopIdOf = (email: string) => {
    const r = auth.register(email, 'password123', 'Цех')
    if (!r.ok) throw new Error(r.error)
    return r.account.shopId
  }

  it('жаңа цех сынақ жоспарында келеді', () => {
    const shopId = shopIdOf('plan-new@example.kz')
    expect(plan.readPlan(shopId).plan.id).toBe('free')
    expect(plan.readPlan(shopId).until).toBeNull()
  })

  it('тариф қойылады әрі мерзімімен оқылады', () => {
    const shopId = shopIdOf('plan-set@example.kz')
    const until = Date.now() + 86_400_000
    plan.setPlan(shopId, 'shop', until)
    const read = plan.readPlan(shopId)
    expect(read.plan.id).toBe('shop')
    expect(read.until).toBe(until)
    expect(read.expired).toBe(false)
  })

  it('МЕРЗІМІ ӨТКЕНДЕ тегін шектерге түседі, бірақ дерек орнында', () => {
    const shopId = shopIdOf('plan-expired@example.kz')
    store.writeProject(shopId, 'Ескі жоба', { any: 'json' })
    plan.setPlan(shopId, 'team', Date.now() - 1000)

    const read = plan.readPlan(shopId)
    expect(read.expired).toBe(true)
    expect(read.plan.id).toBe('free')
    // Жобасы жоғалмаған.
    expect(store.listProjects(shopId)).toHaveLength(1)
  })

  it('қолданыс саналады: жоба мен аккаунт', () => {
    const shopId = shopIdOf('plan-usage@example.kz')
    store.writeProject(shopId, 'Бірінші', {})
    store.writeProject(shopId, 'Екінші', {})
    expect(plan.usageOf(shopId)).toEqual({ projects: 2, members: 1 })
  })

  it('БАР ЖОБА жаңарту лимитке кірмейді: `projectExists` соны айырады', () => {
    const shopId = shopIdOf('plan-update@example.kz')
    const id = store.writeProject(shopId, 'Жоба', {})
    expect(plan.projectExists(shopId, id)).toBe(true)
    expect(plan.projectExists(shopId, 'басқа-id')).toBe(false)
    // Басқа цех сол id-ді өзінікі деп айта алмайды.
    const other = shopIdOf('plan-other@example.kz')
    expect(plan.projectExists(other, id)).toBe(false)
  })

  it('белгісіз тариф қойылмайды', () => {
    const shopId = shopIdOf('plan-bad@example.kz')
    expect(() => plan.setPlan(shopId, 'сатылмайды' as never)).toThrow()
  })
})
