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

export function CodeEntryPage() {
  const [code, setCode] = useState('')
  const valid = /^\d{6}$/.test(code)

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <form
        className="w-full max-w-sm space-y-4 text-center"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) window.location.href = `/view?c=${code}`
        }}
      >
        <h1 className="text-lg font-semibold">{tr('Открыть проект по коду')}</h1>
        <p className="text-sm text-neutral-400">{tr('Введите 6 цифр, которые прислал мастер.')}</p>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-label={tr('Код — 6 цифр')}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-center font-mono text-3xl tabular-nums tracking-[0.4em] outline-none focus:border-neutral-300"
        />
        <button
          type="submit"
          disabled={!valid}
          className="w-full rounded-lg border border-neutral-100 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900 disabled:opacity-40"
        >
          {tr('Открыть')}
        </button>
      </form>
    </main>
  )
}
