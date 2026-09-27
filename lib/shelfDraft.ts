import { parseNumberDraft } from './numberDraft'

/** A blank list restores even spacing; every supplied height is a whole mm. */
export function parseShelfHeights(raw: string, maximum: number):
  { heights: number[]; error?: never } | { error: 'token' | 'range' | 'count'; heights?: never } {
  if (!raw.trim()) return { heights: [] }
  const tokens = raw.split(/[,;]/)
  if (tokens.length > 20) return { error: 'count' }
  const heights: number[] = []
  for (const token of tokens) {
    const parsed = parseNumberDraft(token, { min: 1, max: maximum, integer: true })
    if (parsed.error) return { error: parsed.error === 'range' ? 'range' : 'token' }
    heights.push(parsed.value)
  }
  return { heights }
}

export function shelfHeightsChange(raw: string, count: number, maximum: number):
  { count: number; at: number[] | undefined } | null {
  const parsed = parseShelfHeights(raw, maximum)
  if (parsed.error) return null
  return parsed.heights.length ? { count: parsed.heights.length, at: parsed.heights } : { count, at: undefined }
}

/** An edited count returns to even spacing, so no old explicit heights can override it. */
export function shelfCountChange(count: number, previousCount: number, at: number[] | undefined):
  { count: number; at: number[] | undefined } {
  return { count, at: count === previousCount ? at : undefined }
}
