/** UI теңге мәтіні → бүтін тиын; бөлшек ешқашан үнсіз дөңгелектелмейді. */
export const MAX_MONEY_TIYN = Number.MAX_SAFE_INTEGER
export const MAX_MONEY_TENGE = Math.floor(MAX_MONEY_TIYN / 100)

export function parseMoneyDraft(raw: string, field: string): { value?: number; error?: string } {
  const allowed = `0..${MAX_MONEY_TENGE} ₸, 0–2 ондық таңба`
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim())
  if (!match) return { error: `${field}: рұқсат диапазоны ${allowed}` }
  const value = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  if (value > BigInt(MAX_MONEY_TIYN)) return { error: `${field}: рұқсат диапазоны ${allowed}` }
  return { value: Number(value) }
}

export function formatMoneyDraft(value: number): string {
  const whole = Math.floor(value / 100)
  return `${whole}.${String(value % 100).padStart(2, '0')}`
}
