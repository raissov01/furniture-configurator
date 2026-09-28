'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
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

/**
 * Тақырып жолағы.
 *
 * lg-ден тар экранда бөлім сілтемелері «Меню» батырмасының астына жиналады:
 * бұрын телефонда навигация мүлде жоқ еді, ал тақырып екі қатарға бөлініп,
 * экранның 120 px-ін алатын. Енді бір қатар: белгі · тіл · меню.
 */
export function SiteHeader() {
  const { tr: t, lang, chooseLang } = useSiteText()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: 'var(--rule)', background: 'var(--panel)' }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-2 sm:gap-4 sm:px-8 sm:py-3">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <Mark />
          <span
            className="text-lg tracking-[0.04em]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            {SITE.name}
          </span>
        </Link>

        <nav aria-label={t('Разделы сайта')} className="ml-4 hidden items-center gap-5 text-sm lg:flex" style={{ color: 'var(--ink-soft)' }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="site-link">
              {t(l.label)}
            </Link>
          ))}
        </nav>

        <label className="ml-auto text-xs">
          <span className="sr-only">{t('Язык')}</span>
          <select aria-label={t('Язык')} value={lang} onChange={(event) => chooseLang(event.target.value as typeof LANGS[number]['value'])}
            className="min-h-11 border bg-transparent px-2 text-sm" style={{ borderColor: 'var(--rule)' }}>
            {LANGS.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </label>
        <Link href="/mobile" className="site-link hidden min-h-11 items-center px-2 text-sm sm:inline-flex">
          {t('Телефон · Сегодня')}
        </Link>
        <Link
          href="/configurator"
          className="site-cta hidden border px-4 py-2 text-sm sm:inline-flex sm:min-h-11 sm:items-center"
        >
          {t('Открыть конфигуратор')}
        </Link>
        <button
          ref={buttonRef}
          type="button"
          className="site-ghost inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-sm lg:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('Закрыть') : t('Меню')}
        </button>
      </div>

      {open ? (
        <nav
          id={panelId}
          aria-label={t('Разделы сайта')}
          className="border-t lg:hidden"
          style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
        >
          <ul className="mx-auto w-full max-w-6xl px-5 py-2 sm:px-8">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center border-b text-base" style={{ borderColor: 'var(--rule)' }}>
                  {t(l.label)}
                </Link>
              </li>
            ))}
            <li className="sm:hidden">
              <Link href="/mobile" onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b text-base" style={{ borderColor: 'var(--rule)' }}>
                {t('Телефон · Сегодня')}
              </Link>
            </li>
            <li className="py-3 sm:hidden">
              <Link href="/configurator" onClick={() => setOpen(false)}
                className="site-cta flex min-h-12 items-center justify-center border px-4 text-base">
                {t('Открыть конфигуратор')}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
