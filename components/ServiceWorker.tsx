'use client'

/**
 * Қызметтік жұмысшыны тіркеу.
 *
 * ⚠ ТЕК ӨНДІРІСТЕ. Дамыту режимінде ол кэшті ұстап қалады да, өзгеріс
 * көрінбей, «неге түзетуім қолданылмады» деген уақыт жоғалады.
 */

import { useEffect } from 'react'

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const timer = setTimeout(() => {
      // Тіркеу БЕТ ЖҮКТЕЛГЕННЕН КЕЙІН: ол бірінші кадрмен жарыспауы керек.
      // Мекенжайдағы `v` — құрастырудың белгісі: жаңа нұсқа шыққанда браузер
      // жаңа жұмысшыны орнатады, ал ол ескі кэшті тастайды.
      const version = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
      void navigator.serviceWorker.register(`/sw.js?v=${version}`).catch(() => {
        // Тіркелмесе — қосымша бұрынғыдай жұмыс істей береді.
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [])
  return null
}
