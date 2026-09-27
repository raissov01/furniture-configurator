'use client'

import Link from 'next/link'
import { SITE } from '@/lib/site'
import { siteT as t } from '@/lib/siteLocale'

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--rule)' }}>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-8">
        <div>
          <p className="text-lg tracking-[0.04em]" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            {SITE.name}
          </p>
          <p className="mt-1 max-w-md text-sm" style={{ color: 'var(--ink-soft)' }}>
            {t('Платформа для мебельных цехов Казахстана: корпус, раскрой, присадка и КП.')}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm sm:items-end" style={{ color: 'var(--ink-soft)' }}>
          <Link href="/configurator" className="transition hover:text-[color:var(--ink)]">{t('Конфигуратор')}</Link>
          <Link href="/#pricing" className="transition hover:text-[color:var(--ink)]">{t('Тарифы')}</Link>
          {SITE.email && <a href={`mailto:${SITE.email}`} className="transition hover:text-[color:var(--ink)]">{SITE.email}</a>}
        </div>
      </div>
    </footer>
  )
}
