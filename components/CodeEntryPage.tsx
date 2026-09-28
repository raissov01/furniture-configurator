'use client'

import { useRef, useState } from 'react'
import { Cta, Dimension } from '@/components/brand'
import { t as tr } from '@/lib/i18n'
import { SITE } from '@/lib/site'
import { codeEntryValidation } from '@/lib/codeEntryState'
import type { PublicShareIdentity } from '@/lib/codeEntryState'
import { parseProjectV4 } from '@/src/core/index'

type Preview = { code: string; projectName: string; shop: PublicShareIdentity | null }

export function CodeEntryPage() {
  const [draft, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [lastShop, setLastShop] = useState<PublicShareIdentity | null>(null)
  const requestId = useRef(0)
  const validation = codeEntryValidation(draft)
  const contact = preview?.shop ?? lastShop

  async function verify(): Promise<void> {
    setTouched(true)
    if (!validation.code) return
    const id = ++requestId.current
    setBusy(true)
    setError(null)
    setPreview(null)
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(validation.code)}`, { cache: 'no-store' })
      if (!response.ok) {
        if (id === requestId.current) setError(response.status === 404
          ? tr('Код не найден или его срок истёк: код действует 24 часа. Попросите у мастера новый.')
          : tr('Не удалось открыть проект по коду. Проверьте интернет.'))
        return
      }
      const data = await response.json() as { project: unknown; shop?: PublicShareIdentity | null }
      const project = parseProjectV4(data.project)
      if (id !== requestId.current) return
      const shop = data.shop ?? null
      setPreview({ code: validation.code, projectName: project.name, shop })
      if (shop) setLastShop(shop)
    } catch {
      if (id === requestId.current) setError(tr('Не удалось открыть проект по коду. Проверьте интернет.'))
    } finally {
      if (id === requestId.current) setBusy(false)
    }
  }

  return <main className="site flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-8">
    <div className="sheet w-full max-w-lg p-5 sm:p-8">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        <img src="/brand/aismebel-mark.svg" width={24} height={24} alt="" aria-hidden="true" />{SITE.name}
      </p>
      <h1 className="mt-6 text-3xl font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>{tr('Открыть проект по коду')}</h1>
      <p className="mt-2 text-base text-[var(--ink-soft)]">{tr('Введите 6 цифр, которые прислал мастер.')}</p>
      <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void verify() }}>
        <label htmlFor="share-code" className="block text-sm font-medium text-[var(--ink)]">{tr('Код: 6 цифр')}</label>
        <input id="share-code" inputMode="numeric" autoComplete="one-time-code" value={draft}
          aria-invalid={touched && Boolean(validation.error)} aria-describedby={touched && validation.error ? 'code-error' : undefined}
          onChange={(event) => { requestId.current += 1; setDraft(event.target.value); setTouched(true); setError(null); setPreview(null); setBusy(false) }}
          className={`w-full border bg-[var(--paper)] px-4 py-3 text-center font-mono text-2xl text-[var(--ink)] tabular-nums tracking-[0.25em] outline-none focus-visible:border-[var(--brand-amber)] ${touched && validation.error ? 'border-red-600' : 'border-[var(--rule)]'}`} />
        {touched && validation.error ? <p id="code-error" role="alert" className="text-sm text-red-700">{tr(validation.error)}</p> : null}
        <button type="submit" disabled={busy || !validation.code}
          className="site-cta min-h-11 w-full border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? tr('Проверяем код…') : tr('Проверить код')}
        </button>
      </form>
      {error ? <p role="alert" className="mt-4 border border-red-600 p-3 text-sm text-red-700">{error}</p> : null}
      {preview ? <section className="mt-6 border-t border-[var(--rule)] pt-4" aria-label={tr('Проверенный проект')}>
        <p className="text-xs text-[var(--ink-soft)]">{tr('Проект')}</p>
        <h2 className="text-xl font-semibold text-[var(--ink)]">{preview.projectName}</h2>
        {preview.shop ? <div className="mt-4 flex items-center gap-3">
          {preview.shop.logoDataUrl ? <img src={preview.shop.logoDataUrl} width={44} height={44} alt={preview.shop.name} className="h-11 w-11 border border-[var(--rule)] object-contain" /> : null}
          <p className="text-sm text-[var(--ink)]">{tr('Цех')}: <b>{preview.shop.name}</b></p>
        </div> : null}
        <Dimension label={tr('Код')} value={preview.code} className="py-4" />
        <Cta href={`/view?c=${encodeURIComponent(preview.code)}`}>{tr('Открыть проект')}</Cta>
      </section> : null}
      {error || preview ? <div className="mt-6 border-t border-[var(--rule)] pt-4 text-sm text-[var(--ink-soft)]">
        <p>{tr('Нужен новый код? Свяжитесь с мастером.')}</p>
        {contact ? <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className="font-medium text-[var(--ink)]">{contact.name}</span>
          {contact.phone ? <a className="min-h-11 underline underline-offset-4" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a> : null}
          {contact.whatsappUrl ? <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={contact.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a> : null}
        </div> : null}
      </div> : null}
    </div>
  </main>
}
