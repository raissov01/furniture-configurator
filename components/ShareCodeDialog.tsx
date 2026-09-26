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
import { getLang, t as tr } from '@/lib/i18n'
import { cloudEnabled } from '@/lib/cloud'
import { Button } from '@/components/ui'
import { Spinner } from '@/components/BusyOverlay'
import { useConfigurator } from '@/store/configurator'
import { CommentsInbox } from '@/components/CommentsInbox'
import { InternetRequirement } from '@/components/InternetRequirement'
import { approvalWhatsAppUrl } from '@/lib/mobile/approvalShare'
import { formatTengeExact } from '@/src/core/pricing'

function approvalPreview(): string {
  const scene = document.querySelector<HTMLCanvasElement>('[data-tour="scene"] canvas')
  if (!scene) throw new Error(tr('3D вид ещё не готов. Подождите и повторите.'))
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const context = canvas.getContext('2d')
  if (!context) throw new Error(tr('Не удалось снять 3D вид'))
  context.drawImage(scene, 0, 0, canvas.width, canvas.height)
  const encoded = canvas.toDataURL('image/png').split(',')[1]
  if (!encoded || encoded.length > 1_500_000) throw new Error(tr('Снимок 3D слишком большой'))
  return encoded
}

export function ShareCodeDialog() {
  const open = useConfigurator((s) => s.shareCodeOpen)
  const setOpen = useConfigurator((s) => s.setShareCodeOpen)
  const startShare = useConfigurator((s) => s.startShare)
  const session = useConfigurator((s) => s.shareSession)
  const projectName = useConfigurator((s) => s.projectName)
  const priceMinor = useConfigurator((s) => s.priceOverrides.salePrice)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState('')
  const [approval, setApproval] = useState<{ version: number; confirmationCode: string } | null>(null)

  useEffect(() => { setApproval(null) }, [session?.code])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

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

  const startApproval = async () => {
    if (!session || !online || busy) return
    if (!Number.isSafeInteger(priceMinor) || priceMinor === undefined || priceMinor < 0) {
      setError(tr('Для согласования укажите точную итоговую цену в тиынах.'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const previewPngBase64 = approvalPreview()
      const response = await fetch(`/api/share/${encodeURIComponent(session.code)}/approval`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewPngBase64 }),
      })
      const raw: unknown = await response.json()
      if (!response.ok) {
        const reason = raw && typeof raw === 'object' && 'error' in raw && typeof raw.error === 'string'
          ? raw.error : `${tr('Не удалось начать согласование')} (${response.status})`
        throw new Error(reason)
      }
      if (!raw || typeof raw !== 'object' || !('version' in raw) || !('confirmationCode' in raw) ||
          typeof raw.version !== 'number' || typeof raw.confirmationCode !== 'string' ||
          !/^\d{6}$/.test(raw.confirmationCode)) throw new Error(tr('Неверный ответ сервера'))
      setApproval({ version: raw.version, confirmationCode: raw.confirmationCode })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Не удалось начать согласование'))
    } finally {
      setBusy(false)
    }
  }

  const sendWhatsApp = () => {
    if (!session || !approval || priceMinor === undefined) return
    try {
      const url = approvalWhatsAppUrl({ phone, projectName, priceMinor, shareCode: session.code,
        confirmationCode: approval.confirmationCode, link,
        language: getLang() === 'kk' ? 'kk' : 'ru' })
      if (!window.open(url, '_blank', 'noopener,noreferrer')) throw new Error(tr('Не удалось открыть WhatsApp'))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Не удалось открыть WhatsApp'))
    }
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

        {error && <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
        {!cloudEnabled ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {tr('В этой сборке нет облака — отправьте клиенту ссылку (Проект → Ссылка клиенту).')}
          </p>
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
            <section className="mt-4 border-t border-neutral-300 pt-3 dark:border-neutral-700" data-testid="share-approval">
              <h3 className="text-sm font-semibold">{tr('Согласование версии')}</h3>
              {priceMinor === undefined ? <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                {tr('Для согласования укажите точную итоговую цену в тиынах.')}
              </p> : <p className="mt-2 text-sm">{tr('Цена')}: {formatTengeExact(priceMinor)}</p>}
              <button type="button" disabled={!online || busy || priceMinor === undefined}
                className="mt-2 min-h-11 w-full border border-neutral-400 bg-white px-3 py-2 text-sm text-black disabled:bg-neutral-200 disabled:text-neutral-600"
                onClick={() => void startApproval()}>{busy ? tr('Подождите…') : tr('Отправить версию на согласование')}</button>
              <InternetRequirement feature="publishShare" online={online} />
              {approval && <div className="mt-3 space-y-2 border border-neutral-300 p-3 text-sm">
                <p>{tr('Версия')}: {approval.version}</p>
                <p>{tr('Код подтверждения')}: <strong className="font-mono text-lg">{approval.confirmationCode}</strong></p>
                <p className="text-xs">{tr('Передайте код клиенту; после перезагрузки он больше не показывается.')}</p>
                <label className="block">{tr('Телефон клиента с кодом страны')}
                  <input className="mt-1 min-h-11 w-full border border-neutral-400 bg-white px-3 text-base text-black"
                    type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)}
                    placeholder="+7 701 123 45 67" />
                </label>
                <button type="button" disabled={!online} onClick={sendWhatsApp}
                  className="min-h-11 w-full border border-neutral-400 bg-white px-3 py-2 text-sm text-black disabled:bg-neutral-200 disabled:text-neutral-600">
                  {tr('Отправить КП и код через WhatsApp')}
                </button>
                <InternetRequirement feature="whatsappLink" online={online} />
              </div>}
            </section>
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
