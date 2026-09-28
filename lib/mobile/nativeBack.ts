import { useEffect, useRef } from 'react'

/**
 * Android «Артқа» батырмасы: MainActivity алдымен `window.aismebelBack()` шақырады
 * (true — бет өзі өңдеді), болмаса WebView тарихы, ол да бос болса — қосымшадан шығу.
 * Шебер сияқты React күйіндегі экрандар тарихқа жазылмайды, сондықтан осы ілмек керек.
 */
declare global {
  interface Window { aismebelBack?: () => boolean }
}

export function useNativeBack(handler: (() => void) | null): void {
  const latest = useRef(handler)
  latest.current = handler
  const active = handler !== null
  useEffect(() => {
    if (!active) return
    const hook = () => { latest.current?.(); return true }
    window.aismebelBack = hook
    return () => { if (window.aismebelBack === hook) delete window.aismebelBack }
  }, [active])
}
