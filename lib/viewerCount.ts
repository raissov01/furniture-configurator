import type { Lang } from './i18n'

export function cabinetCountLabel(count: number, lang: Lang): string {
  if (lang === 'en') return `${count} ${count === 1 ? 'cabinet' : 'cabinets'}`
  if (lang === 'uz') return `${count} korpus`
  if (lang === 'kk') return `${count} корпус`
  const lastTwo = count % 100
  const last = count % 10
  const suffix = lastTwo >= 11 && lastTwo <= 14 ? 'корпусов'
    : last === 1 ? 'корпус' : last >= 2 && last <= 4 ? 'корпуса' : 'корпусов'
  return `${count} ${suffix}`
}
