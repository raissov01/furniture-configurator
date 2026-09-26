/**
 * Цехтың тарифі: оқу, қою, лимитті тексеру.
 *
 * ТӨЛЕМ МҰНДА ЖОҚ. Ақшаны қабылдау — бөлек жұмыс (эквайринг, чек, қайтару),
 * ал оны жарты-жарым істеу қауіпті. Сондықтан бұл қабат тек «қай цехта қай
 * тариф» деген сұраққа жауап береді, ал тарифті ӘЗІРГЕ иесі қолмен қояды
 * (`npm run plan -- <email> <тариф> [күн]`). Төлем жүйесі қосылғанда, ол
 * дәл осы `setPlan`-ды шақырады — қалған кодты өзгертудің қажеті болмайды.
 */

import { billingEnabled } from '../billing'
import { DEFAULT_PLAN, PLANS, isPlanId, planOf } from '../plans'
import type { Plan, PlanId, PlanUsage } from '../plans'
import { db } from './db'
import { audit } from './observability'

export type ShopPlan = {
  plan: Plan
  /** Мерзімі біткен уақыт, мс. `null` — мерзімсіз. */
  until: number | null
  /** Мерзімі өтіп кеткен бе (сонда тегін жоспардың лимиттері істейді). */
  expired: boolean
}

export function readPlan(shopId: string, now = Date.now()): ShopPlan {
  /*
   * ТЕГІН КЕЗЕҢ. Ақы алу сөндірулі тұрғанда әр цех ШЕКТЕУСІЗ жоспарда
   * болады — базадағы жазба қандай болса да. Дерек сақталады: `BILLING=on`
   * деген күні цех қай тарифте тұрғаны сол қалпында табылады.
   */
  if (!billingEnabled()) return { plan: PLANS.team, until: null, expired: false }

  const row = db().prepare('SELECT plan, plan_until FROM shops WHERE id = ?').get(shopId) as
    | { plan: string | null; plan_until: number | null }
    | undefined

  const until = row?.plan_until ?? null
  const expired = until !== null && until < now
  /*
   * ⚠ МЕРЗІМІ ӨТКЕН ТАРИФ ТЕГІНГЕ ТҮСЕДІ, аккаунт ЖАБЫЛМАЙДЫ. Цехтың
   * жобалары орнында қалады, тек ЖАҢАСЫН сақтау шектеледі — жұмысты
   * құлыптау деген клиентті жоғалту деген сөз.
   */
  return {
    plan: planOf(expired ? DEFAULT_PLAN : row?.plan),
    until,
    expired,
  }
}

export function setPlan(shopId: string, plan: PlanId, until: number | null = null): void {
  if (!isPlanId(plan)) throw new Error(`Белгісіз тариф: ${plan}`)
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const result = database.prepare('UPDATE shops SET plan = ?, plan_until = ? WHERE id = ?').run(plan, until, shopId)
    if (result.changes) audit({ shopId, action: 'set', entityType: 'price', entityId: shopId, detail: { plan, until } })
    database.exec('COMMIT')
  } catch (cause) { database.exec('ROLLBACK'); throw cause }
}

export function usageOf(shopId: string): PlanUsage {
  const projects = db()
    .prepare('SELECT COUNT(*) AS n FROM projects WHERE shop_id = ?')
    .get(shopId) as { n: number }
  const members = db()
    .prepare('SELECT COUNT(*) AS n FROM users WHERE shop_id = ?')
    .get(shopId) as { n: number }
  return { projects: projects.n, members: members.n }
}

/** Осы id-мен жоба БАР ма — жаңарту лимитке кірмейді. */
export function projectExists(shopId: string, id: string): boolean {
  const row = db()
    .prepare('SELECT 1 AS ok FROM projects WHERE shop_id = ? AND id = ?')
    .get(shopId, id) as { ok: number } | undefined
  return row !== undefined
}
