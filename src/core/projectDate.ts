/** Жобаның күнін тексеру және қағазға шығару: уақыт белдеуіне тәуелсіз. */
import { ConfigValidationError } from './errors'

export function isValidProjectDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]!
}

/** ISO YYYY-MM-DD → ДД.ММ.ГГГГ; жарамсыз күнді үнсіз шығармайды. */
export function formatProjectDate(value: string): string {
  if (!isValidProjectDate(value)) {
    throw new ConfigValidationError('info.date', `${value} — күнтізбеде жоқ күн`, 'YYYY-MM-DD, нақты күн')
  }
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
}
