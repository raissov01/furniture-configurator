'use client'

import Link from 'next/link'
import { t } from '@/lib/i18n'
import { SITE } from '@/lib/site'

export default function NotFound() {
  return <main className="flex min-h-dvh w-full flex-col justify-center bg-[var(--neutral-100)] px-5 py-12 text-[var(--brand-graphite)] sm:px-8">
    <div className="mx-auto w-full max-w-2xl">
    <p className="mb-4 flex items-center gap-2 border-b pb-3 text-sm font-semibold"><img src="/brand/aismebel-mark.svg" width={24} height={24} alt="" aria-hidden="true" />{SITE.name} · 404</p>
    <h1 className="text-3xl font-bold">{t('Страница не найдена')}</h1>
    <p className="mt-3 text-base">{t('Запрошенной страницы нет.')}</p>
    <Link href="/" className="mt-6 inline-flex min-h-11 w-fit items-center border border-current px-4 py-2 text-sm">
      {t('Вернуться на главную')}
    </Link>
    </div>
  </main>
}
