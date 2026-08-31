'use client'

/**
 * Тіл ауысқанда бүкіл ағашты қайта құрады.
 *
 * `t()` — қарапайым функция, hook емес, сондықтан React оның нәтижесі
 * өзгергенін өзі байқай алмайды. Тіл сирек ауысатындықтан, ең қарапайым әрі
 * ең сенімді жол — `key` арқылы қайта монтаждау: жарты бетте орысша, жарты
 * бетте қазақша қалып қою мүмкін емес.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { applySavedLang, getLang, subscribeLang } from '@/lib/i18n'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(getLang())

  useEffect(() => subscribeLang(() => setLangState(getLang())), [])

  // Сақталған тіл БОЯЛҒАНҒА ДЕЙІН қолданылады: гидратация сервердікімен
  // бірдей орысшадан басталады, ал пайдаланушы орысшаның жарқылын көрмейді.
  useLayoutEffect(() => { applySavedLang() }, [])

  return <div key={lang} className="contents">{children}</div>
}
