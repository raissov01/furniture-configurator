'use client'

import { useCallback, useEffect, useState } from 'react'
import { t } from '@/lib/i18n'
import type { ProjectFileV4 } from '@/src/core/projectV4'
import { formatTengeExact } from '@/src/core/pricing'
import { InternetRequirement } from '@/components/InternetRequirement'

type ApprovalStatus = {
  version: number
  hash: string
  priceMinor: number
  status: 'pending' | 'approved' | 'changed'
  seal: { approvedAt: number } | null
}
type State = { kind: 'loading' } | { kind: 'none' } | { kind: 'ready'; value: ApprovalStatus } | { kind: 'error'; message: string }

export function ApprovalPanel({ code, project }: { code: string; project: ProjectFileV4 }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [online, setOnline] = useState(true)
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const endpoint = `/api/share/${encodeURIComponent(code)}/approval`

  const refresh = useCallback(async () => {
    if (!navigator.onLine) { setOnline(false); return }
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      if (response.status === 404) { setState({ kind: 'none' }); return }
      if (!response.ok) throw new Error(`${t('Не удалось проверить согласование')} (${response.status})`)
      const raw: unknown = await response.json()
      if (!raw || typeof raw !== 'object' || !('status' in raw) || !('version' in raw) || !('priceMinor' in raw) || !('hash' in raw) ||
          !['pending', 'approved', 'changed'].includes(String(raw.status)) ||
          !Number.isSafeInteger(raw.version) || !Number.isSafeInteger(raw.priceMinor) || typeof raw.hash !== 'string') {
        throw new Error(t('Неверный ответ сервера'))
      }
      setState({ kind: 'ready', value: raw as ApprovalStatus })
      setMessage('')
    } catch (cause) {
      setState({ kind: 'error', message: cause instanceof Error ? cause.message : t('Не удалось проверить согласование') })
    }
  }, [endpoint])

  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) void refresh() }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [refresh, project])

  const approve = async () => {
    if (!online || !/^\d{6}$/.test(otp) || sending) return
    setSending(true)
    try {
      const response = await fetch(endpoint, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationCode: otp }),
      })
      if (!response.ok) {
        const raw: unknown = await response.json()
        const reason = raw && typeof raw === 'object' && 'error' in raw && typeof raw.error === 'string'
          ? raw.error : `${t('Не удалось подтвердить')} (${response.status})`
        throw new Error(reason)
      }
      setOtp('')
      await refresh()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t('Не удалось подтвердить'))
    } finally {
      setSending(false)
    }
  }

  return <section data-testid="client-approval" className="max-h-[35dvh] overflow-y-auto border-t border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white">
    <h2 className="font-semibold">{t('Согласование версии')}</h2>
    {state.kind === 'loading' && <p className="mt-2">{t('Проверяем версию…')}</p>}
    {state.kind === 'none' && <p className="mt-2">{t('Мастер ещё не отправил версию на согласование.')}</p>}
    {state.kind === 'error' && <p role="alert" className="mt-2">{state.message}</p>}
    {state.kind === 'ready' && <div className="mt-2 space-y-2">
      <p>{t('Версия')}: {state.value.version}</p>
      {state.value.status !== 'changed' && <p>{t('Цена')}: {formatTengeExact(state.value.priceMinor)}</p>}
      {state.value.status === 'changed' && <p role="alert">{t('Проект изменился. Попросите новую версию.')}</p>}
      {state.value.status === 'pending' && <div className="space-y-2">
        <p>{t('Введите шестизначный код из сообщения мастера.')}</p>
        <label className="block">
          <span>{t('Код подтверждения')}</span>
          <input aria-label={t('Код подтверждения')} className="mt-1 block min-h-12 w-full border border-[#8c8c8c] bg-white px-3 text-base text-black"
            inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        </label>
        <button type="button" className="min-h-12 w-full border border-[#8c8c8c] bg-white px-4 py-2 text-black disabled:bg-[#666] disabled:text-[#ddd]"
          disabled={!online || sending || otp.length !== 6} onClick={() => void approve()}>{t('Подтверждаю эту версию')}</button>
        <InternetRequirement feature="clientApproval" online={online} dark />
      </div>}
      {state.value.status === 'approved' && <div className="space-y-2">
        <p role="status">{t('Версия согласована')}</p>
        {state.value.seal && <p>{new Date(state.value.seal.approvedAt).toLocaleString()}</p>}
        {online ? <a className="block min-h-12 border border-[#8c8c8c] bg-white px-4 py-3 text-center text-black"
          href={`${endpoint}?version=${state.value.version}&format=pdf`}>{t('Скачать PDF с печатью')}</a>
          : <span aria-disabled="true" className="block min-h-12 border border-[#8c8c8c] bg-[#666] px-4 py-3 text-center text-[#ddd]">{t('Скачать PDF с печатью')}</span>}
        <InternetRequirement feature="cloudDownload" online={online} dark />
      </div>}
    </div>}
    {!online && <p className="mt-2 text-[#d4d4d4]">{t('Подключитесь к сети, чтобы продолжить.')}</p>}
    {message && <p role="alert" className="mt-2 text-[#ffb4b4]">{message}</p>}
  </section>
}
