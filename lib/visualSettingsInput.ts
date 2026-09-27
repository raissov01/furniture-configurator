import { t as tr } from './i18n'

type Parsed = { value: number | undefined | null; error: string | null }

/** Өріс жолы жоба күйіне тек толық жарамды сан болса ғана өтеді. */
export function parseVisualNumber(
  raw: string, label: string, min: number, max: number, integer = false, optional = false,
): Parsed {
  if (optional && raw.trim() === '') return { value: undefined, error: null }
  const value = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) {
    const range = integer ? tr('Допустимо целое число в диапазоне') : tr('Допустимо число в диапазоне')
    return { value: null, error: `${label}: ${range} ${min}–${max}` }
  }
  return { value, error: null }
}

export function parseNormalUrl(raw: string): { value: string | null; error: string | null } {
  const label = tr('Карта нормалей (URL)')
  try {
    const url = new URL(raw.trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') return { value: raw.trim(), error: null }
  } catch { /* Төменде өріске қатысты қатені көрсетеміз. */ }
  return { value: null, error: `${label}: ${tr('Допустим URL с http:// или https://')}` }
}
