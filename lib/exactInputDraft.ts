import { parseExactMm } from '@/src/core/exactMm'

/** Validate draft text without changing the saved board or its position. */
export function exactInputDraft(text: string, current: number, field: string, positive: boolean):
  { value: number; error?: never } | { error: string; value?: never } {
  const allowed = positive ? 'бүтін мм > 0' : 'қауіпсіз бүтін мм'
  try {
    const value = parseExactMm(text, current)
    if (positive && value <= 0) return { error: `${field}: өлшем оң бүтін мм болуы керек — рұқсат етілген: ${allowed}` }
    return { value }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'мән қате'
    return { error: `${field}: ${reason} — рұқсат етілген: ${allowed}` }
  }
}
