'use client'

/**
 * Тілді ауыстыру. Таңдау localStorage-та сақталады.
 *
 * Бір батырма + мәзір: бұрын төрт батырма («РУС ҚАЗ UZB ENG») тақтада қатар
 * тұрып, оны екі қатарға бөліп жіберетін. Тіл сирек ауысады — көзде тек
 * ағымдағысы тұрса жетеді.
 */

import { LANGS, getLang, setLang, t as tr } from '@/lib/i18n'
import { Menu, MenuItem } from '@/components/ui'

/** Батырмадағы қысқа белгі. */
const SHORT: Record<(typeof LANGS)[number]['value'], string> = {
  ru: 'РУС',
  kk: 'ҚАЗ',
  uz: 'UZB',
  en: 'ENG',
}

export function LangSwitch({ inline = false }: { inline?: boolean }) {
  const current = getLang()
  const items = <>
      <div className="border-t border-neutral-200 px-2 py-1 text-xs dark:border-neutral-700">{tr('Язык')}</div>
      {LANGS.map((l) => (
        <MenuItem key={l.value} active={current === l.value} onClick={() => setLang(l.value)}>
          <span className="w-8 tabular-nums">{SHORT[l.value]}</span>
          {l.label}
        </MenuItem>
      ))}
    </>
  if (inline) return items
  return <Menu label={SHORT[current]} title={tr('Язык')} align="right">{items}</Menu>
}
