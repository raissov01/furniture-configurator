'use client'

/**
 * Аккаунт: тіркелу, кіру, бұлттағы жобалар.
 *
 * Кірмеген цех бәрібір толық жұмыс істейді — дерек браузерде жатады.
 * Кіргенде профиль мен жобалар СЕРВЕРГЕ көшеді: басқа компьютерден де,
 * қайта орнатқаннан кейін де сол жерде тұрады.
 */

import { useCallback, useEffect, useState } from 'react'
import { parseProject, parseShopProfile } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { Button, Field } from '@/components/ui'

type Account = { email: string; shopName: string }
type ProjectRow = { id: string; name: string; updatedAt: number }

const input =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none ' +
  'focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300'

export function AccountPanel() {
  const open = useConfigurator((s) => s.accountOpen)
  const setOpen = useConfigurator((s) => s.setAccountOpen)
  const shop = useConfigurator((s) => s.shop)
  const setShop = useConfigurator((s) => s.setShop)
  const exportProject = useConfigurator((s) => s.exportProject)
  const loadProject = useConfigurator((s) => s.loadProject)

  const [account, setAccount] = useState<Account | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ email: '', password: '', shopName: '' })
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (!res.ok) return
    const data = (await res.json()) as { projects?: ProjectRow[] }
    setProjects(data.projects ?? [])
  }, [])

  // Кім кіргенін бет ашылғанда бір рет сұраймыз.
  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/me')
      const data = (await res.json()) as { account?: Account | null }
      if (data.account) {
        setAccount(data.account)
        void refreshProjects()
      }
    })()
  }, [refreshProjects])

  /**
   * Кіргеннен кейінгі бірінші синхрондау: серверде профиль бар болса —
   * оны аламыз, жоқ болса — өзіміздікін жібереміз. Осылайша бұрын
   * браузерде толтырылған бағалар жоғалмайды.
   */
  const syncProfile = useCallback(async () => {
    const res = await fetch('/api/shop')
    if (!res.ok) return
    const data = (await res.json()) as { profile?: unknown }
    if (data.profile) {
      try {
        setShop(parseShopProfile(data.profile))
        return
      } catch {
        // Серверде ескі не бүлінген жазба: өзіміздікімен ауыстырамыз.
      }
    }
    await fetch('/api/shop', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: shop }),
    })
  }, [setShop, shop])

  // Кірген кезде профильдің әр өзгерісі серверге де жазылады.
  useEffect(() => {
    if (!account) return
    const timer = setTimeout(() => {
      void fetch('/api/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: shop }),
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [account, shop])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as { account?: Account; error?: string }
      if (!res.ok || !data.account) {
        setError(data.error ?? 'Не получилось')
        return
      }
      setAccount(data.account)
      setForm({ email: '', password: '', shopName: '' })
      await syncProfile()
      await refreshProjects()
    } finally {
      setBusy(false)
    }
  }

  const saveToCloud = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: exportProject() }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) setError(data.error ?? 'Не сохранилось')
      else await refreshProjects()
    } finally {
      setBusy(false)
    }
  }

  const openProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) return
    const data = (await res.json()) as { project?: unknown }
    try {
      loadProject(parseProject(data.project))
      setOpen(false)
    } catch (e) {
      setError(`Проект не открылся: ${e instanceof Error ? e.message : 'неверная форма'}`)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{account ? account.shopName : 'Вход в аккаунт'}</h2>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>Закрыть</Button>
          </div>
        </div>

        {error ? (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {account ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">{account.email}</p>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Проекты в облаке
              </span>
              <Button onClick={() => void saveToCloud()} disabled={busy} active>
                Сохранить текущий
              </Button>
            </div>

            {projects.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Пока пусто. Сохраните текущий проект — он откроется на любом компьютере.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-700"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openProject(p.id)}>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 tabular-nums text-neutral-400">
                        {new Date(p.updatedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </button>
                    <Button
                      onClick={() => void (async () => {
                        await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
                        await refreshProjects()
                      })()}
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <Button
                onClick={() => void (async () => {
                  await fetch('/api/auth/logout', { method: 'POST' })
                  setAccount(null)
                  setProjects([])
                })()}
              >
                Выйти
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1">
              <Button active={mode === 'login'} onClick={() => setMode('login')}>Вход</Button>
              <Button active={mode === 'register'} onClick={() => setMode('register')}>Регистрация</Button>
            </div>

            {mode === 'register' ? (
              <Field label="Название цеха">
                <input className={input} value={form.shopName} placeholder="Цех «Алаш»"
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
              </Field>
            ) : null}

            <Field label="Почта">
              <input className={input} type="email" autoComplete="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Пароль" hint={mode === 'register' ? 'от 8 символов' : undefined}>
              <input className={input} type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={form.password}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>

            <Button onClick={() => void submit()} disabled={busy} active>
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>

            <p className="text-[11px] leading-snug text-neutral-400">
              Без аккаунта конфигуратор работает полностью — данные лежат в этом браузере.
              Аккаунт нужен, чтобы профиль цеха и проекты были доступны с другого компьютера.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
