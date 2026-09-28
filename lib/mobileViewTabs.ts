import type { Lang } from './i18n'

/** Short visual label; the full translated name stays on the button's aria-label. */
const SHORT: Record<'perspective' | 'axo', Record<Lang, string>> = {
  perspective: { ru: 'Персп.', kk: 'Персп.', en: 'Persp.', uz: 'Persp.' },
  axo: { ru: 'Аксон.', kk: 'Аксон.', en: 'Axon.', uz: 'Akson.' },
}

export function mobileViewLabel(key: string, lang: Lang, fullLabel: string): string {
  if (key === 'perspective' || key === 'axo') return SHORT[key][lang]
  return fullLabel
}
