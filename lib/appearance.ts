/**
 * Көрініс баптаулары: ТЕМА мен 3D САПАСЫ.
 *
 * Екеуі де — АДАМНЫҢ ӨЗ ЫҢҒАЙЫ, жобаның қасиеті емес: сондықтан браузерде
 * сақталады (жиылатын бөлімдер мен тіл сияқты), жоба файлына кірмейді.
 * Жоба басқа компьютерде ашылғанда сол адамның баптауы қолданылады.
 */

export type Theme = 'system' | 'light' | 'dark'
/** 3D сапасы: әлсіз ноутбукте «үнемді» режим кадрды жеңілдетеді. */
export type Quality = 'low' | 'medium' | 'high'

const THEME_KEY = 'furniture-configurator:theme'
const QUALITY_KEY = 'furniture-configurator:quality'

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key)
    return allowed.includes(saved as T) ? (saved as T) : fallback
  } catch {
    // Жеке терезеде localStorage тыйылуы мүмкін — әдепкі күй жеткілікті.
    return fallback
  }
}

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high']

export function readTheme(): Theme {
  return read(THEME_KEY, THEMES, 'system')
}

export function readQuality(): Quality {
  return read(QUALITY_KEY, QUALITIES, 'high')
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch { /* сақталмаса, таңдау осы сеансқа қалады */ }
}

export function saveQuality(quality: Quality): void {
  try {
    window.localStorage.setItem(QUALITY_KEY, quality)
  } catch { /* жоғарыдағыдай */ }
}

/**
 * Теманы DOM-ға қолдану.
 *
 * `data-theme` тамыр элементте тұрады, ал CSS `dark:` варианты соны да,
 * жүйенің `prefers-color-scheme`-ін де түсінеді (`globals.css` қара).
 * `color-scheme` — браузердің ӨЗ элементтері (скроллбар, `<select>`,
 * күнтізбе) үшін: онсыз қараңғы бетте ақ скроллбар тұрады.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    delete root.dataset['theme']
    root.style.colorScheme = 'light dark'
  } else {
    root.dataset['theme'] = theme
    root.style.colorScheme = theme
  }
}

/**
 * 3D канвастың параметрлері.
 *
 * `dpr` — ең қымбат баптау: 2× пиксель тығыздығы 4 есе көп пиксель деген сөз.
 * Әлсіз ноутбукте сол ғана кадрды екі есе жылдамдатады.
 */
export function canvasSettings(quality: Quality): { dpr: [number, number]; antialias: boolean } {
  switch (quality) {
    case 'low':
      return { dpr: [1, 1], antialias: false }
    case 'medium':
      return { dpr: [1, 1.5], antialias: true }
    default:
      return { dpr: [1, 2], antialias: true }
  }
}
