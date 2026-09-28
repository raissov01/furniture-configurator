/**
 * Лендингтің құрылымдық бөлшектері.
 *
 * Бөлімдерді бөлетін сызық — өнімнің өз тілі: сызбадағы ӨЛШЕМ СЫЗЫҒЫ, үстінде
 * нақты миллиметр саны. Ол әшекей емес: әр сан беттегі мазмұнға қатысты
 * (парақтың ені, пропил, кромка) — оқыған адам цехтың тілін бірден таниды.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

export function Dimension({ value, label }: { value: string; label?: string }) {
  return (
    <div className="dimline py-6 text-xs tracking-[0.06em]" style={{ fontFamily: 'var(--font-mono)' }}>
      <span>{label ?? ''}</span>
      <span className="dimline-track" />
      <span>{value}</span>
    </div>
  )
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-3xl leading-[1.05] sm:text-5xl"
      style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.01em' }}
    >
      {children}
    </h2>
  )
}

export function Section({
  id, children, className = '',
}: { id?: string; children: ReactNode; className?: string }) {
  return (
    // scroll-mt: жабысқақ тақырып якорьге өткенде бөлім атауын жауып қалмауы үшін.
    <section id={id} className={`mx-auto w-full max-w-6xl scroll-mt-20 px-5 sm:px-8 ${className}`}>
      {children}
    </section>
  )
}

export function Cta({
  href, children, tone = 'solid',
}: { href: string; children: ReactNode; tone?: 'solid' | 'ghost' }) {
  // Күйлер (hover / pressed / focus) — `globals.css`-тегі .site-cta / .site-ghost.
  return (
    <Link
      href={href}
      className={`${tone === 'solid' ? 'site-cta' : 'site-ghost'} inline-flex min-h-11 items-center gap-2 border px-5 py-3 text-sm`}
    >
      {children}
    </Link>
  )
}

/** Титул блогы: сызбадағыдай, сол жақта белгі — оң жақта мазмұн. */
export function Titled({
  mark, markLabel, title, children,
}: { mark: string; markLabel?: string; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
      {/* Реттік сан мағына тасиды (қадамдар тізбегі), сондықтан «Шаг» сөзінсіз, үлкен цифр. */}
      <div
        aria-label={markLabel}
        className="text-3xl leading-none tabular-nums sm:text-4xl"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--oak-deep)' }}
      >
        {mark}
      </div>
      <div>
        <h3 className="mb-1.5 text-lg" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {title}
        </h3>
        <div className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{children}</div>
      </div>
    </div>
  )
}
