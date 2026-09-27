'use client'

import Link from 'next/link'
import { SITE } from '@/lib/site'
import { t as tr } from '@/lib/i18n'

/** Белгі — AisMebel логотипі (`public/brand/`, өзгертпейміз). */
function Mark() {
  return <img src="/brand/aismebel-mark.svg" width={24} height={24} alt="" aria-hidden="true" />
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
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: 'var(--rule)', background: 'var(--panel)' }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Mark />
          <span
            className="text-lg tracking-[0.04em]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            {SITE.name}
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-sm lg:flex" style={{ color: 'var(--ink-soft)' }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-[color:var(--ink)]">
              {tr(l.label)}
            </Link>
          ))}
        </nav>

        <Link
          href="/configurator"
          className="ml-auto border px-4 py-2 text-sm transition"
          style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
        >
          {tr('Открыть конфигуратор')}
        </Link>
      </div>
    </header>
  )
}
