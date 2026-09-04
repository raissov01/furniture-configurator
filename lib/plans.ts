/**
 * Тариф жоспарлары.
 *
 * ⚠ БҰЛ ФАЙЛДА БАҒА ЖОҚ. Мұнда тек ЛИМИТТЕР тұрады — өнім нені шектейді
 * деген сұрақтың жауабы. Ақшаның саны — иесінің шешімі, әрі ол уақыт өтіп
 * өзгереді; кодқа жазсақ, оны өзгерту үшін қайта деплой керек болар еді.
 * Баға `PLAN_PRICE_<PLAN>` айнымалысынан оқылады (тиынмен), қойылмаса —
 * «келісіледі» деп көрсетіледі.
 *
 * НЕГЕ ЛИМИТ ЖОБАНЫҢ САНЫ. Цех үшін ең түсінікті шек — бұлтта сақталған
 * жоба саны: ол тікелей дискіні де, сақтық көшірмені де жейді. Экспортты
 * (Базис, ЧПУ, раскрой) ЕШҚАШАН шектемейміз: жарты-жарым экспорт цехтың
 * тапсырысын бүлдіреді, ал бүлінген тапсырыс — жоғалған клиент.
 */

export type PlanId = 'free' | 'shop' | 'team'

export type Plan = {
  id: PlanId
  name: string
  /** Бұлтта сақталатын жоба саны. `null` — шексіз. */
  projects: number | null
  /** Бір цехтағы аккаунт саны. `null` — шексіз. */
  members: number | null
  /** Қысқа сипаттама — аккаунт терезесінде тұрады. */
  note: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Пробный',
    projects: 3,
    members: 1,
    note: 'Конфигуратор толық: раскрой, присадка, экспорт. Бұлтта 3 жоба сақталады.',
  },
  shop: {
    id: 'shop',
    name: 'Цех',
    projects: null,
    members: 3,
    note: 'Жоба саны шексіз, цехта үш аккаунтқа дейін.',
  },
  team: {
    id: 'team',
    name: 'Команда',
    projects: null,
    members: null,
    note: 'Шектеусіз: жоба да, аккаунт та.',
  },
}

export const DEFAULT_PLAN: PlanId = 'free'

export function isPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'shop' || value === 'team'
}

export function planOf(id: unknown): Plan {
  return isPlanId(id) ? PLANS[id] : PLANS[DEFAULT_PLAN]
}

/**
 * Жоспардың бағасы, тиынмен. `null` — қойылмаған («келісіледі»).
 *
 * ЕШҚАНДАЙ ӘДЕПКІ САН ЖОҚ: ойдан жазылған баға сайтта тұрып қалса, оны
 * клиент шындық деп оқиды.
 */
export function planPrice(id: PlanId, env: Record<string, string | undefined> = process.env): number | null {
  const raw = env[`PLAN_PRICE_${id.toUpperCase()}`]
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}

export type PlanUsage = { projects: number; members: number }

export type LimitCheck = { ok: true } | { ok: false; reason: string }

/**
 * Жаңа жоба сақтауға бола ма.
 *
 * ⚠ БАР ЖОБАНЫ ЖАҢАРТУҒА ӘРҚАШАН БОЛАДЫ. Лимитке жеткен цех өз жобасын
 * ашып, өзгертіп, қайта сақтай алуы керек: әйтпесе төлемей қалған адамның
 * ЖҰМЫСЫ құлыпталып қалар еді, ал ол — оның еңбегі, біздің емес.
 */
export function canAddProject(plan: Plan, usage: PlanUsage): LimitCheck {
  if (plan.projects === null || usage.projects < plan.projects) return { ok: true }
  return {
    ok: false,
    reason: `«${plan.name}» тарифінде бұлтта ${plan.projects} жоба сақталады. `
      + 'Ескісін өшіріңіз немесе тарифті көтеріңіз — жобаның өзі жоғалмайды.',
  }
}

/** Цехқа тағы бір адам қосуға бола ма. */
export function canAddMember(plan: Plan, usage: PlanUsage): LimitCheck {
  if (plan.members === null || usage.members < plan.members) return { ok: true }
  return {
    ok: false,
    reason: `«${plan.name}» тарифінде ${plan.members} аккаунт. Тарифті көтеріңіз.`,
  }
}
