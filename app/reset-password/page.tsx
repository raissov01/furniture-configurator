'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { t as tr } from '@/lib/i18n'
import { resetPasswordError } from '@/lib/passwordResetUi'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), [])
  const passwordError = touched ? resetPasswordError(password) : null
  const submit = async () => {
    setTouched(true)
    if (resetPasswordError(password) || !token || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }) })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) setError(result.error ?? tr('Ссылка недействительна или срок истёк'))
      else { setDone(true); setPassword('') }
    } catch {
      setError(tr('Нет связи с сервером'))
    } finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-neutral-50 px-4 py-12 text-neutral-900">
    <section className="mx-auto max-w-md border border-neutral-300 bg-white p-5">
      <h1 className="text-xl font-semibold">{tr('Новый пароль')}</h1>
      {done ? <p role="status" className="mt-4">{tr('Пароль изменён. Войдите снова.')}</p> : <>
        <p className="mt-2 text-sm text-neutral-700">{tr('Ссылка действует 30 минут и только один раз.')}</p>
        <label className="mt-4 block text-sm">{tr('Новый пароль')}
          <input type="password" autoComplete="new-password" value={password} aria-invalid={Boolean(passwordError)}
            className={`mt-1 min-h-11 w-full border bg-white px-3 ${passwordError ? 'border-red-600' : 'border-neutral-400'}`}
            onChange={(event) => { setPassword(event.target.value); setTouched(true) }} />
        </label>
        {passwordError ? <p role="alert" className="mt-1 text-sm text-red-700">{tr(passwordError)}</p> : null}
        {!token ? <p role="alert" className="mt-2 text-sm text-red-700">{tr('Ссылка недействительна или срок истёк')}</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-red-700">{tr(error)}</p> : null}
        <button type="button" disabled={busy || !token} onClick={() => void submit()}
          className="mt-4 min-h-11 border border-neutral-900 bg-neutral-900 px-4 text-white disabled:opacity-50">
          {tr('Сохранить пароль')}
        </button>
      </>}
      <p className="mt-4 text-sm"><Link href="/configurator" className="underline">{tr('К конфигуратору')}</Link></p>
    </section>
  </main>
}
