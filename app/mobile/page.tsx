'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { t } from '@/lib/i18n'
import type { Role } from '@/lib/permissions'
import { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { createMobileSyncTransport } from '@/lib/mobile/syncTransport'
import { MeasurementSurveySchema, type MeasurementSurvey } from '@/src/core/measure'
import { SyncQueue } from '@/src/core/sync/queue'
import type { JsonValue, NetworkState, SyncRecord } from '@/src/core/sync/types'
import { MeasurementWizard } from '@/components/mobile/MeasurementWizard'
import { enqueueLatestMeasurement, keepLocalMeasurement, retryDelay, retryRejectedMeasurement } from '@/components/mobile/measurementSync'
import { emptySurvey, parseSavedMeasurementDraft } from '@/components/mobile/measurementModel'
import { configuratorKitchenTarget, handoffMeasurementToKitchen } from '@/components/mobile/kitchenHandoff'

const ROLE_CACHE = 'tapsyrys:role' // UI navigation only; projects, measurements and photos are in IndexedDB.
const roles: Role[] = ['owner', 'designer', 'shop', 'client']
const button = 'block min-h-12 w-full border border-[#8c8c8c] bg-white px-4 py-3 text-left text-base text-black disabled:bg-[#ededed] disabled:text-[#666]'

function cachedRole(): { role: Role | null; unavailable: boolean } {
  try {
    const value = localStorage.getItem(ROLE_CACHE)
    return { role: roles.find((role) => role === value) ?? null, unavailable: false }
  } catch {
    return { role: null, unavailable: true }
  }
}

export default function MobileTodayPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [store, setStore] = useState<IndexedDbMobileStore | null>(null)
  const [queue, setQueue] = useState<SyncQueue | null>(null)
  const [online, setOnline] = useState(true)
  const [network, setNetwork] = useState<NetworkState>('unknown')
  const [sending, setSending] = useState(false)
  const [surveys, setSurveys] = useState<MeasurementSurvey[]>([])
  const [active, setActive] = useState<MeasurementSurvey | null>(null)
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState<SyncRecord[]>([])
  const [rejected, setRejected] = useState<SyncRecord[]>([])
  const [message, setMessage] = useState('')

  const refresh = useCallback(async (db: IndexedDbMobileStore) => {
    const raw = await db.listSurveys()
    setSurveys(raw.flatMap((value) => {
      const draft = parseSavedMeasurementDraft(value)
      return draft ? [draft] : []
    }))
    const records = await db.list()
    setPending(records.filter((record) => record.status === 'pending').length)
    setConflicts(records.filter((record) => record.status === 'conflict'))
    setRejected(records.filter((record) => record.status === 'rejected' && record.action.kind === 'measurement.upsert'))
  }, [])

  const reconcile = useCallback(async (db: IndexedDbMobileStore, sync: SyncQueue) => {
    const records = await db.list()
    const submitted = new Set(records.filter((record) => record.action.kind === 'measurement.upsert').map((record) => record.action.entityId))
    for (const value of await db.listSurveys()) {
      const parsed = MeasurementSurveySchema.safeParse(value)
      if (!parsed.success || !submitted.has(parsed.data.id)) continue
      await enqueueLatestMeasurement(parsed.data, db, sync, Date.now(), crypto.randomUUID())
    }
    await refresh(db)
  }, [refresh])

  useEffect(() => {
    let mounted = true
    let db: IndexedDbMobileStore | undefined
    const cached = cachedRole()
    setRole(cached.role)
    if (cached.unavailable) setMessage(t('Роль не сохранилась на устройстве; проверьте её через интернет'))
    setOnline(navigator.onLine)
    const init = async () => {
      try {
        db = await IndexedDbMobileStore.open()
        if (!mounted) { db.close(); return }
        setStore(db)
        const sync = new SyncQueue(db, createMobileSyncTransport(db))
        setQueue(sync)
        await refresh(db)
        setSending(navigator.onLine)
        await sync.setOnline(navigator.onLine, Date.now())
        if (mounted) { setNetwork(sync.network); setSending(false) }
        if (mounted) await reconcile(db, sync)
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : t('Локальное хранилище недоступно'))
      }
    }
    void init()
    const checkRole = async () => {
      if (!navigator.onLine) return
      try {
        const response = await fetch('/api/me', { credentials: 'same-origin' })
        if (!response.ok) throw new Error(t('Не удалось проверить роль'))
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('account' in data)) return
        const account = data.account
        if (account === null) {
          if (mounted) setRole(null)
          try { localStorage.removeItem(ROLE_CACHE) } catch {
            if (mounted) setMessage(t('Роль не сохранилась на устройстве; проверьте её через интернет'))
          }
          return
        }
        if (account && typeof account === 'object' && 'role' in account && roles.includes(account.role as Role)) {
          const found = account.role as Role
          if (mounted) setRole(found)
          try { localStorage.setItem(ROLE_CACHE, found) } catch {
            if (mounted) setMessage(t('Роль не сохранилась на устройстве; проверьте её через интернет'))
          }
        }
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : t('Не удалось проверить роль'))
      }
    }
    void checkRole()
    return () => { mounted = false; db?.close() }
  }, [reconcile, refresh])

  useEffect(() => {
    if (!queue || !store) return
    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const schedule = async () => {
      if (retryTimer) clearTimeout(retryTimer)
      const next = await queue.nextRetryAt()
      const delay = retryDelay(next, Date.now(), navigator.onLine)
      if (disposed || delay === undefined) return
      retryTimer = setTimeout(() => {
        void sendAndSchedule()
      }, delay)
    }
    const sendAndSchedule = async () => {
      setSending(navigator.onLine)
      try {
        await queue.setOnline(navigator.onLine, Date.now())
        if (disposed) return
        setNetwork(queue.network)
        await reconcile(store, queue)
        await schedule()
      } catch (error) {
        if (!disposed) setMessage(error instanceof Error ? error.message : t('Не удалось отправить очередь'))
      } finally {
        if (!disposed) setSending(false)
      }
    }
    const change = () => {
      setOnline(navigator.onLine)
      void sendAndSchedule()
    }
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    void schedule().catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('Не удалось отправить очередь')))
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
    }
  }, [pending, queue, reconcile, store])

  const saveSurvey = async (survey: MeasurementSurvey) => {
    if (!store || !queue) throw new Error(t('Локальное хранилище недоступно'))
    await store.putSurvey(survey.id, survey as unknown as JsonValue)
    setSending(online)
    try {
      const result = await enqueueLatestMeasurement(survey, store, queue, Date.now(), crypto.randomUUID())
      setNetwork(queue.network)
      await refresh(store)
      return result
    } finally { setSending(false) }
  }

  const resolveConflict = async (record: SyncRecord, keepLocal: boolean) => {
    if (!store || !queue || !record.conflict) return
    try {
      if (keepLocal) {
        const raw = await store.getSurvey(record.action.entityId)
        const survey = MeasurementSurveySchema.parse(raw)
        await keepLocalMeasurement(survey, record, store, queue, Date.now(), crypto.randomUUID())
      } else {
        const server = MeasurementSurveySchema.parse(record.conflict.serverValue)
        await queue.resolveConflict(record.action.id, { kind: 'keepServer' }, Date.now())
        await store.putSurvey(server.id, server as unknown as JsonValue)
      }
      await refresh(store)
      setNetwork(queue.network)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Не удалось разрешить конфликт'))
    }
  }

  const retryRejected = async (record: SyncRecord) => {
    if (!store || !queue || !online) return
    try {
      const raw = await store.getSurvey(record.action.entityId)
      const survey = MeasurementSurveySchema.parse(raw)
      setSending(true)
      await retryRejectedMeasurement(survey, record, store, queue, Date.now(), crypto.randomUUID())
      setNetwork(queue.network)
      await refresh(store)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Не удалось повторить отправку'))
    } finally { setSending(false) }
  }

  const createKitchen = async (survey: MeasurementSurvey) => {
    if (!store) throw new Error(t('Локальное хранилище недоступно'))
    await saveSurvey(survey)
    await handoffMeasurementToKitchen(survey, configuratorKitchenTarget((id, project) => store.putProject(id, project)))
    router.push(`/configurator?measurement=${encodeURIComponent(survey.id)}`)
  }

  const networkLabel = !online ? t('Нет сети') : sending ? t('Отправляется') :
    network === 'unreachable' ? t('Сервер недоступен') : t('В сети')
  const networkColor = !online || network === 'unreachable' ? 'border-[#8c8c8c] bg-[#ededed]' : 'border-[#28723b] bg-[#e7f4e9]'

  if (active && store) return <MeasurementWizard initial={active} store={store} onBack={() => { setActive(null); void refresh(store) }} onSave={saveSurvey} onKitchen={createKitchen} pending={pending} networkLabel={networkLabel} networkColor={networkColor} />

  return <main className="mx-auto min-h-dvh w-full max-w-xl overflow-x-hidden bg-[#f5f5f5] p-4 text-black">
    <div role="status" className={`mb-4 border p-3 text-sm ${networkColor}`}>
      {networkLabel} · {t('Ожидает отправки')}: {pending}
    </div>
    <header className="mb-6">
      <p className="text-sm font-semibold tracking-wide">{t('Заказ')}</p>
      <h1 className="mt-1 text-2xl font-semibold">{role === 'shop' ? t('Цех') : role === 'client' ? t('Клиент') : t('Сегодня')}</h1>
    </header>
    {!role && <div className="border border-[#8c8c8c] bg-white p-4 text-sm">
      <p>{t('Для первого входа и проверки роли нужен интернет.')}</p>
      {online ? <Link className={`${button} mt-3`} href="/configurator">{t('Войти')}</Link> :
        <button className={`${button} mt-3`} type="button" disabled>{t('Войти')}</button>}
      <p className="mt-1 text-xs text-[#525252]">{t('Работает через интернет')}</p>
    </div>}
    {(role === 'owner' || role === 'designer') && <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('Следующее действие')}</h2>
      <button className={`${button} !border-[#005a9e] !bg-[#005a9e] !font-semibold !text-white`} type="button" disabled={!store}
        onClick={() => setActive(emptySurvey(crypto.randomUUID(), Date.now()))}>{t('Новый замер')}</button>
      <Link className={button} href="/configurator">{t('Новая КП')}</Link>
      <h2 className="pt-2 text-base font-semibold">{t('Замеры на этом устройстве')}</h2>
      {surveys.length === 0 && <p className="border border-[#b8b8b8] bg-white p-3 text-sm">{t('Пока нет сохранённых замеров')}</p>}
      {surveys.map((survey) => <button key={survey.id} className={button} type="button" onClick={() => setActive(survey)}>
        {t('Замер')} · {survey.id.slice(0, 8)}
      </button>)}
    </section>}
    {role === 'shop' && <section className="space-y-3">
      <p className="border border-[#b8b8b8] bg-white p-3 text-sm">{t('Работа цеха: сканирование деталей и монтаж.')}</p>
      <p className="border border-[#b8b8b8] bg-white p-3 text-sm">{t('Сканирование и монтаж ещё готовятся.')}</p>
    </section>}
    {role === 'client' && <section className="border border-[#b8b8b8] bg-white p-3 text-sm">
      {t('Откройте ссылку на своё предложение от мастерской.')}
    </section>}
    {conflicts.map((record) => <section key={record.action.id} className="mt-4 border border-[#9b1c1c] bg-white p-3 text-sm">
      <h2 className="font-semibold">{t('Конфликт замера')} · {record.action.entityId.slice(0, 8)}</h2>
      <p className="mt-1">{t('На сервере есть другая версия. Выберите явно, какую оставить.')}</p>
      <details className="mt-2"><summary>{t('Сравнить версии')}</summary>
        <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify({ local: record.action.payload, server: record.conflict?.serverValue }, null, 2)}</pre>
      </details>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className={button} type="button" onClick={() => void resolveConflict(record, true)}>{t('Оставить мою')}</button>
        <button className={button} type="button" onClick={() => void resolveConflict(record, false)}>{t('Оставить серверную')}</button>
      </div>
    </section>)}
    {rejected.map((record) => <section key={record.action.id} className="mt-4 border border-[#9b1c1c] bg-white p-3 text-sm">
      <h2 className="font-semibold">{t('Отправка замера отклонена')} · {record.action.entityId.slice(0, 8)}</h2>
      <p className="mt-1">{record.error ?? t('Проверьте вход и попробуйте снова')}</p>
      <button className={`${button} mt-2`} type="button" disabled={!online} onClick={() => void retryRejected(record)}>{t('Повторить отправку')}</button>
      <p className="mt-1 text-xs text-[#525252]">{t('Работает через интернет')}</p>
    </section>)}
    {message && <p role="alert" className="mt-4 border border-[#9b1c1c] bg-white p-3 text-sm text-[#9b1c1c]">{message}</p>}
  </main>
}
