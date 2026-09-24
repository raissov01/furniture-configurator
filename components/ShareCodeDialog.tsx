'use client'

/**
 * КЛИЕНТКЕ КОД — qdesign «3D-көріністе ашу» терезесі сияқты (09-13).
 *
 * Олардікі: 6 таңбалы код, «Код 24 сағат жарамды», «Автоматты жаңарту».
 * Бізде қосымша керек емес: клиент телефонда `/c` бетін ашып, кодты тереді
 * (не сілтемені басады) — жоба 3D-де, прогулкамен ашылады. Жоба өзгерсе,
 * автосақтау оны кодқа қайта жібереді, клиенттің экраны өзі жаңарады.
 */

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { cloudEnabled } from '@/lib/cloud'
import { Button } from '@/components/ui'
import { Spinner } from '@/components/BusyOverlay'
import { useConfigurator } from '@/store/configurator'
import { CommentsInbox } from '@/components/CommentsInbox'

export function ShareCodeDialog() {
  const open = useConfigurator((s) => s.shareCodeOpen)
  const setOpen = useConfigurator((s) => s.setShareCodeOpen)
  const startShare = useConfigurator((s) => s.startShare)
  const session = useConfigurator((s) => s.shareSession)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Терезе ашылғанда код жоқ не мерзімі өткен болса — жаңасы жасалады.
  useEffect(() => {
    if (!open || !cloudEnabled) return undefined
    if (session && session.expiresAt > Date.now()) return undefined
    let alive = true
    void startShare().then((result) => {
      if (alive) setError(result.ok ? null : result.error)
    })
    return () => { alive = false }
  }, [open, session, startShare])

  if (!open) return null
  const link = session ? `${window.location.origin}/view?c=${session.code}` : ''
  const copy = (text: string, done: string) => {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(done),
      () => setCopied(tr('Скопировать не удалось')),
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label={tr('Код для клиента')}
        className="mt-24 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{tr('Код для клиента')}</h2>
          <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
        </div>

        {!cloudEnabled ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {tr('В этой сборке нет облака — отправьте клиенту ссылку (Проект → Ссылка клиенту).')}
          </p>
        ) : error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        ) : !session ? (
          <div className="py-6"><Spinner label={tr('Создаём код…')} /></div>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              {tr('Клиент открывает страницу и вводит код — проект откроется у него в 3D, с прогулкой.')}
            </p>
            <div data-share-code className="my-4 text-center font-mono text-4xl tabular-nums tracking-[0.3em]">
              {session.code}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button active onClick={() => copy(session.code, tr('Код скопирован'))}>{tr('Скопировать код')}</Button>
              <Button onClick={() => copy(link, tr('Ссылка на проект скопирована'))}>{tr('Скопировать ссылку')}</Button>
            </div>
            <p className="mt-3 text-center text-[11px] text-neutral-500">
              {window.location.origin}/c · {tr('Код действует 24 часа')}
            </p>
            <p className="mt-1 text-center text-[11px] text-neutral-500">
              {tr('Автообновление: изменения видны клиенту через несколько секунд.')}
            </p>
            <div className="mt-3"><CommentsInbox session={session} /></div>
            {copied ? (
              <p role="status" className="mt-2 text-center text-xs text-neutral-700 dark:text-neutral-200">{copied}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
