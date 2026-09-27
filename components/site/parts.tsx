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
    <div className="dimline py-6 text-[11px] tracking-[0.18em]" style={{ fontFamily: 'var(--font-mono)' }}>
      <span>{label ?? ''}</span>
      <span className="dimline-track" />
      <span>{value}</span>
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-3 text-[11px] uppercase tracking-[0.22em]"
      style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
    >
      {children}
    </p>
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
  const solid = tone === 'solid'
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 border px-5 py-3 text-sm transition"
      style={
        solid
          ? { background: 'var(--cta-bg)', color: 'var(--cta-ink)', borderColor: 'var(--cta-bg)' }
          : { background: 'transparent', color: 'var(--ink)', borderColor: 'var(--ink)' }
      }
    >
      {children}
    </Link>
  )
}

/** Титул блогы: сызбадағыдай, сол жақта белгі — оң жақта мазмұн. */
export function Titled({
  mark, title, children,
}: { mark: string; title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
      <div
        className="text-[11px] uppercase tracking-[0.2em]"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--blueprint)' }}
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
