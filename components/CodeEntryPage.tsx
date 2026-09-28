'use client'

/**
 * КОДПЕН АШУ беті (`/c`) — qdesign-ның QDesignPreview қосымшасының орны.
 *
 * Олардікі: клиент қосымшаны орнатып, 6 таңбалы кодты тереді. Бізде
 * қосымша керек емес: телефонның браузерінде осы бетті ашып, кодты тереді —
 * жоба `/view?c=…`-да 3D-де, прогулкамен ашылады.
 */

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { SITE } from '@/lib/site'

export function CodeEntryPage() {
  const [code, setCode] = useState('')
  const valid = /^\d{6}$/.test(code)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-graphite)] px-6 text-white">
      <form
        className="w-full max-w-sm space-y-4 text-center"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) window.location.href = `/view?c=${code}`
        }}
      >
        <p className="flex items-center justify-center gap-2 text-sm font-semibold"><img src="/brand/aismebel-mark.svg" width={24} height={24} alt="" aria-hidden="true" />{SITE.name}</p>
        <h1 className="text-lg font-semibold">{tr('Открыть проект по коду')}</h1>
        <p className="text-sm text-neutral-200">{tr('Введите 6 цифр, которые прислал мастер.')}</p>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-label={tr('Код — 6 цифр')}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full border border-[var(--rule)] bg-[var(--paper)] px-4 py-3 text-center font-mono text-3xl text-[var(--ink)] tabular-nums tracking-[0.4em] outline-none focus:border-[var(--brand-amber)]"
        />
        <button
          type="submit"
          disabled={!valid}
          className="w-full border border-[var(--brand-amber)] bg-[var(--brand-amber)] px-4 py-3 text-sm font-semibold text-[var(--brand-graphite)] disabled:border-[var(--neutral-400)] disabled:bg-[var(--neutral-400)]"
        >
          {tr('Открыть')}
        </button>
      </form>
    </main>
  )
}
