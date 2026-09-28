import type { Lang } from './i18n'

export function templateCountLabel(count: number, lang: Lang): string {
  if (lang === 'en') return `${count} ${count === 1 ? 'template' : 'templates'}`
  if (lang === 'uz') return `${count} shablon`
  if (lang === 'kk') return `${count} үлгі`
  const lastTwo = count % 100
  const last = count % 10
  const noun = lastTwo >= 11 && lastTwo <= 14 ? 'шаблонов'
    : last === 1 ? 'шаблон' : last >= 2 && last <= 4 ? 'шаблона' : 'шаблонов'
  return `${count} ${noun}`
}
