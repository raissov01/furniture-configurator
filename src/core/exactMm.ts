/** Дәл мм енгізу: бүтін сан абсолют, +N/-N салыстырмалы; =-N теріс абсолют. */
import { ConfigValidationError } from './errors'

export function parseExactMm(text: string, current: number): number {
  if (!Number.isSafeInteger(current)) throw new ConfigValidationError('current', 'бүтін мм керек', 'бүтін мм')
  const input = text.trim()
  if (!/^(?:\d+|[+-]\d+|=-\d+)$/.test(input)) {
    throw new ConfigValidationError('value', 'дәл бүтін мм немесе +/- ығысу керек', 'мысалы 600, +20, -10 немесе =-100')
  }
  const value = Number(input.startsWith('=') ? input.slice(1) : input)
  const result = input.startsWith('+') || input.startsWith('-') ? current + value : value
  if (!Number.isSafeInteger(result)) throw new ConfigValidationError('value', 'координата шектен асты', 'қауіпсіз бүтін мм')
  return result
}
