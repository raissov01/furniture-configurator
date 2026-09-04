'use client'

/** Тілді ауыстыру. Таңдау localStorage-та сақталады. */

import { LANGS, getLang, setLang } from '@/lib/i18n'
import { Button } from '@/components/ui'

/** Батырмадағы қысқа белгі: төрт тіл қатарға сыюы керек. */
const SHORT: Record<(typeof LANGS)[number]['value'], string> = {
  ru: 'РУС',
  kk: 'ҚАЗ',
  uz: 'UZB',
  en: 'ENG',
}

export function LangSwitch() {
  const current = getLang()
  return (
    <div className="flex items-center gap-1">
      {LANGS.map((l) => (
        <Button
          key={l.value}
          active={current === l.value}
          onClick={() => setLang(l.value)}
          title={l.label}
        >
          {SHORT[l.value]}
        </Button>
      ))}
    </div>
  )
}
