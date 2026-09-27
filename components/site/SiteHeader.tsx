'use client'

import Link from 'next/link'
import { SITE } from '@/lib/site'
import { LANGS } from '@/lib/i18n'
import { useSiteText } from '@/components/site/SiteLanguage'

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
  const { tr: t, lang, chooseLang } = useSiteText()
  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: 'var(--rule)', background: 'var(--panel)' }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-5 py-3 sm:gap-4 sm:px-8">
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
              {t(l.label)}
            </Link>
          ))}
        </nav>

        <label className="ml-auto text-xs sm:ml-auto">
          <span className="sr-only">{t('Язык')}</span>
          <select aria-label={t('Язык')} value={lang} onChange={(event) => chooseLang(event.target.value as typeof LANGS[number]['value'])}
            className="min-h-11 border bg-transparent px-2 text-sm" style={{ borderColor: 'var(--rule)' }}>
            {LANGS.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </label>
        <Link href="/mobile" className="inline-flex min-h-11 items-center border px-2 text-sm sm:px-4"
          style={{ borderColor: 'var(--rule)' }}>{t('Телефон · Сегодня')}</Link>
        <Link
          href="/configurator"
          className="hidden border px-4 py-2 text-sm transition sm:inline-flex sm:min-h-11 sm:items-center"
          style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
        >
          {t('Открыть конфигуратор')}
        </Link>
      </div>
    </header>
  )
}
