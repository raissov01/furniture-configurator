'use client'

import Link from 'next/link'
import { SITE } from '@/lib/site'

/** Белгі — кромкасы бар плита кесіндісі: өнім осы туралы. */
function Mark() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
      <rect x="0.5" y="0.5" width="25" height="19" fill="var(--oak)" fillOpacity="0.85" stroke="var(--oak-deep)" />
      <rect x="0.5" y="0.5" width="4" height="19" fill="var(--oak-deep)" />
    </svg>
  )
}

const LINKS = [
  { href: '/#artifacts', label: 'Что получает цех' },
  { href: '/#how', label: 'Как это работает' },
  { href: '/#rules', label: 'Правила цеха' },
  { href: '/#pricing', label: 'Тарифы' },
]

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: 'var(--rule)', background: 'color-mix(in srgb, var(--panel) 88%, transparent)' }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Mark />
          <span
            className="text-lg tracking-[0.18em]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            {SITE.name}
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-sm lg:flex" style={{ color: 'var(--ink-soft)' }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-[color:var(--ink)]">
              {l.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/configurator"
          className="ml-auto border px-4 py-2 text-sm transition"
          style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
        >
          Открыть конфигуратор
        </Link>
      </div>
    </header>
  )
}
