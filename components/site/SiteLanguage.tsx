'use client'

import { createContext, useContext, useLayoutEffect, useState } from 'react'
import { getLang, setLang, subscribeLang, type Lang } from '@/lib/i18n'
import { siteFormatFor, siteTranslate } from '@/lib/siteLocale'

const SiteLang = createContext<Lang | null>(null)

export function SiteLanguageProvider({ initialLang, explicit, children }: {
  initialLang: Lang
  explicit: boolean
  children: React.ReactNode
}) {
  const [lang, setSiteLang] = useState(initialLang)

  useLayoutEffect(() => {
    const unsubscribe = subscribeLang(() => setSiteLang(getLang()))
    if (!explicit) setSiteLang(getLang())
    return unsubscribe
  }, [explicit])

  return <SiteLang.Provider value={lang}>{children}</SiteLang.Provider>
}

export function useSiteText() {
  const lang = useContext(SiteLang)
  if (!lang) throw new Error('SiteLanguageProvider is required')
  return {
    lang,
    tr: (text: string) => siteTranslate(text, lang),
    format: (text: string, values: Record<string, string | number>) => siteFormatFor(text, values, lang),
    chooseLang: (next: Lang) => {
      setLang(next)
      window.location.assign(next === 'ru' ? '/' : `/?lang=${next}`)
    },
  }
}
