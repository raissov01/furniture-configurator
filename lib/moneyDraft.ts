/** UI теңге мәтіні → бүтін тиын; бөлшек ешқашан үнсіз дөңгелектелмейді. */
export const MAX_MONEY_TIYN = Number.MAX_SAFE_INTEGER
export const MAX_MONEY_TENGE = Math.floor(MAX_MONEY_TIYN / 100)
export const MAX_MONEY_TENGE_TEXT = `${MAX_MONEY_TENGE}.${String(MAX_MONEY_TIYN % 100).padStart(2, '0')}`

export function parseMoneyDraft(raw: string, field: string, words: {
  allowed: string; decimals: string
} = { allowed: 'допустимо', decimals: 'до 2 знаков после запятой' }): { value?: number; error?: string } {
  const allowed = `0..${MAX_MONEY_TENGE_TEXT} ₸, ${words.decimals}`
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim())
  if (!match) return { error: `${field}: ${words.allowed} ${allowed}` }
  const value = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  if (value > BigInt(MAX_MONEY_TIYN)) return { error: `${field}: ${words.allowed} ${allowed}` }
  return { value: Number(value) }
}

export function formatMoneyDraft(value: number): string {
  const whole = Math.floor(value / 100)
  return `${whole}.${String(value % 100).padStart(2, '0')}`
}
