import { t as tr } from './i18n'

/** Панельдің бастапқы атауы экспорт пен модельде қалады; тек UI мәтіні аударылады. */
export function panelDisplayLabel(label: string, translate: (key: string) => string = tr): string {
  const whole = translate(label)
  if (whole !== label) return whole
  const comma = label.indexOf(',')
  if (comma < 0) return label
  const base = label.slice(0, comma)
  const translated = translate(base)
  return translated === base ? label : `${translated}${label.slice(comma)}`
}
