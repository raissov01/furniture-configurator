import { countLabel } from './countLabel'
import type { Lang } from './i18n'

/** Галереядағы үлгі саны: ортақ countLabel септеуіне сүйенеді. */
export function templateCountLabel(count: number, lang: Lang): string {
  return countLabel(count, 'Шаблон', lang)
}
