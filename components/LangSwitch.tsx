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

export function LangSwitch() {
  const current = getLang()
  return (
    <Menu label={SHORT[current]} title={tr('Язык')} align="right">
      {LANGS.map((l) => (
        <MenuItem key={l.value} active={current === l.value} onClick={() => setLang(l.value)}>
          <span className="w-8 tabular-nums">{SHORT[l.value]}</span>
          {l.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
