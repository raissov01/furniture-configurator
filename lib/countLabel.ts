import { en } from './locales/en'
import { kk } from './locales/kk'
import { uz } from './locales/uz'
import type { Lang } from './i18n'

type CountNoun = 'Шаблон' | 'Корпус' | 'Дверь' | 'Ящик'

const forms: Record<CountNoun, [string, string, string]> = {
  Шаблон: ['шаблон', 'шаблона', 'шаблонов'],
  Корпус: ['корпус', 'корпуса', 'корпусов'],
  Дверь: ['дверь', 'двери', 'дверей'],
  Ящик: ['ящик', 'ящика', 'ящиков'],
}

/** Count labels are UI grammar, independent of manufacturing dimensions. */
export function countLabel(count: number, noun: CountNoun, lang: Lang): string {
  if (lang === 'ru') {
    const lastTwo = count % 100
    const index = lastTwo >= 11 && lastTwo <= 14 ? 2 : count % 10 === 1 ? 0 : count % 10 >= 2 && count % 10 <= 4 ? 1 : 2
    return `${count} ${forms[noun][index]}`
  }
  if (lang === 'en') {
    const singular = (en[noun] ?? noun).toLowerCase()
    return `${count} ${count === 1 ? singular : `${singular}s`}`
  }
  return `${count} ${((lang === 'kk' ? kk[noun] : uz[noun]) ?? noun).toLowerCase()}`
}
