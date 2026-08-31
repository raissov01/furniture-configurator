/**
 * Екі тіл: орысша және қазақша.
 *
 * КІЛТ — ОРЫСША ЖОЛДЫҢ ӨЗІ. Себебі: аудармасы жоқ жол экранда БОС ЕМЕС,
 * орысша болып шығады. Жасанды кілт (`quote.total`) қолданса, сөздікте
 * жоқ жол «quote.total» болып көрінер еді де, оны цех қате деп ұғар еді.
 * Бұл сондай-ақ аударманы БІРТІНДЕП қосуға мүмкіндік береді: жаңа жол
 * сөздікке түспей тұрып та жұмыс істей береді.
 *
 * НЕГЕ HOOK ЕМЕС. `t()` — модуль деңгейіндегі қарапайым функция, ал тіл
 * ауысқанда бүкіл ағаш `I18nProvider`-дің `key`-і арқылы қайта құрылады.
 * Тіл сирек ауысады, ал бұл әр компонентке hook қосудан құтқарады —
 * әрі `t()`-ті кез келген жерде, шарттың ішінде де шақыруға болады.
 */

import { kk } from './locales/kk'

export type Lang = 'ru' | 'kk'

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'kk', label: 'Қазақша' },
]

const STORAGE_KEY = 'furniture-configurator:lang'

/**
 * Сөздік СТАТИКАЛЫҚ импортталады (≈8 КБ), ал тіл модуль жүктелген сәтте-ақ
 * localStorage-тан оқылады.
 *
 * НЕГЕ БЫЛАЙ. Бұрын сөздік `await import()` арқылы кейін келетін де, бет
 * алдымен ОРЫСША, сосын ҚАЗАҚША болып ЕКІ РЕТ монтaжделетін. Одан екі зиян:
 * пайдаланушы орысшаның жарқылын көретін, әрі 3D сахна қайта құрылатын.
 */
let dictionary: Record<string, string> = {}
let current: Lang = 'ru'

function readSaved(): Lang {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'kk' ? 'kk' : 'ru'
  } catch {
    return 'ru'
  }
}

/**
 * Сақталған тілді ҚОЛДАНУ.
 *
 * ⚠ БҰНЫ МОДУЛЬ ЖҮКТЕЛГЕНДЕ ІСТЕУГЕ БОЛМАЙДЫ. Сервер localStorage-ты
 * көрмейді, сондықтан ол әрқашан орысша HTML береді. Клиент бірден қазақша
 * рендерлесе, гидратация сәйкессіздігі шығады — React ағашты қайта құрып,
 * консольге қате жазады.
 *
 * Сол себепті бірінші рендер СЕРВЕРДІКІМЕН БІРДЕЙ (орысша) болады, ал тіл
 * `useLayoutEffect`-те, БОЯЛҒАНҒА ДЕЙІН ауысады: пайдаланушы орысшаны
 * көрмейді, ал гидратация таза қалады.
 */
export function applySavedLang(): void {
  const saved = readSaved()
  if (saved !== current) {
    current = saved
    dictionary = saved === 'kk' ? kk : {}
    for (const fn of listeners) fn()
  }
}

/** Тіл ауысқанда хабарланатындар (Provider). */
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return current
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setLang(lang: Lang): void {
  if (lang === current) return
  dictionary = lang === 'kk' ? kk : {}
  current = lang
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Жеке терезеде localStorage тыйылуы мүмкін — тіл сол сеанста ғана тұрады.
  }
  for (const fn of listeners) fn()
}

/**
 * Аудару. Сөздікте жоқ жол СОЛ КҮЙІ қайтады — экран ешқашан бос қалмайды.
 */
export function t(text: string): string {
  return dictionary[text] ?? text
}

/**
 * Орны толтырылатын жол: `tf('Осталось {n} дней', { n: 5 })`.
 *
 * Сан мен атауды жолға ҚОСПАЙ, орын арқылы беру керек: қазақшада сөз реті
 * басқа, ал біріктірілген жолды аудару мүмкін емес.
 */
export function tf(text: string, vars: Record<string, string | number>): string {
  return t(text).replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole)
}
