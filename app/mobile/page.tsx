'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { t } from '@/lib/i18n'
import { BRAND } from '@/src/core/brand'
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
import type { WallId } from '@/src/core/types'
import type { RoomTolerance } from '@/src/core/measure'
import { nextNetworkMessage } from '@/components/mobile/measurementUiLogic'
import { connectionError, connectionState, mobileErrorMessage } from '@/components/mobile/connectionState'
import { measurementCaption, visibleNetworkMessage } from '@/lib/f00kDisplay'
import { authRetryCandidates } from '@/components/mobile/offlineHandoff'

const ROLE_CACHE = 'tapsyrys:role' // UI navigation only; projects, measurements and photos are in IndexedDB.
const roles: Role[] = ['owner', 'designer', 'shop', 'client']
const button = 'block min-h-12 w-full border border-[var(--rule)] bg-[var(--paper)] px-4 py-3 text-left text-base text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50'

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
  /** Сервер /api/me арқылы расталған рөл (кэштегі рөл сессияның тірі екенін білдірмейді). */
  const [verifiedRole, setVerifiedRole] = useState<Role | null>(null)
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
  const [durableStorage, setDurableStorage] = useState<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
  const [offlineSince, setOfflineSince] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let mounted = true
    const persist = async () => {
      const storage = navigator.storage
      if (!storage?.persist) { if (mounted) setDurableStorage('unavailable'); return }
      try {
        const granted = await storage.persist()
        if (mounted) setDurableStorage(granted ? 'granted' : 'denied')
      } catch { if (mounted) setDurableStorage('unavailable') }
    }
    void persist()
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => { mounted = false; clearInterval(timer) }
  }, [])

  useEffect(() => {
    const key = 'tapsyrys:offline-since'
    if (online) {
      setOfflineSince(null)
      try { localStorage.removeItem(key) } catch { /* Reminder still works during this session. */ }
      return
    }
    let since = Date.now()
    try {
      const saved = Number(localStorage.getItem(key))
      if (Number.isSafeInteger(saved) && saved > 0 && saved <= since) since = saved
      localStorage.setItem(key, String(since))
    } catch { /* Reminder still works during this session. */ }
    setOfflineSince(since)
  }, [online])

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
        db.onVersionChange = () => { if (mounted) window.location.reload() }
        setStore(db)
        const sync = new SyncQueue(db, createMobileSyncTransport(db))
        setQueue(sync)
        await refresh(db)
        setSending(navigator.onLine)
        await sync.setOnline(navigator.onLine, Date.now())
        if (mounted) { setNetwork(sync.network); setSending(false) }
        if (mounted) await reconcile(db, sync)
      } catch (error) {
        if (mounted) setMessage(t(mobileErrorMessage(error, 'Локальное хранилище недоступно', navigator.onLine)))
      }
    }
    void init()
    const checkRole = async () => {
      if (!navigator.onLine) return
      try {
        const response = await fetch('/api/me', { credentials: 'same-origin' })
        if (!response.ok) throw new Error(t('Не удалось проверить роль'))
        const data: unknown = await response.json()
        if (mounted) { setNetwork('online'); setMessage((current) => nextNetworkMessage(current, true, t('Сервер недоступен'), t('Нет сети'))) }
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
          if (mounted) { setRole(found); setVerifiedRole(found) }
          try { localStorage.setItem(ROLE_CACHE, found) } catch {
            if (mounted) setMessage(t('Роль не сохранилась на устройстве; проверьте её через интернет'))
          }
        }
      } catch (error) {
        if (mounted && connectionError(error, navigator.onLine)) setNetwork(navigator.onLine ? 'unreachable' : 'offline')
        if (mounted) setMessage(!navigator.onLine ? t('Нет сети') :
          error instanceof TypeError ? t('Сервер недоступен') :
            error instanceof Error ? error.message : t('Не удалось проверить роль'))
      }
    }
    void checkRole()
    window.addEventListener('online', checkRole)
    return () => { mounted = false; db?.close(); window.removeEventListener('online', checkRole) }
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
        if (!disposed) {
          if (connectionError(error, navigator.onLine)) setNetwork(navigator.onLine ? 'unreachable' : 'offline')
          setMessage(t(mobileErrorMessage(error, 'Не удалось отправить очередь', navigator.onLine)))
        }
      } finally {
        if (!disposed) setSending(false)
      }
    }
    const change = () => {
      setOnline(navigator.onLine)
      if (!navigator.onLine) setMessage((current) => nextNetworkMessage(current, false, t('Сервер недоступен'), t('Нет сети')))
      void sendAndSchedule()
    }
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    void schedule().catch((error: unknown) => setMessage(t(mobileErrorMessage(error, 'Не удалось отправить очередь', navigator.onLine))))
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
    }
  }, [pending, queue, reconcile, store])

  // Гибрид қосымша: офлайн өлшемдер кірмей тұрып жіберілсе 401 алады. Кіргені
  // расталған соң (рөл owner/designer) оларды бір рет автоматты қайта жібереміз.
  const authRetried = useRef(false)
  useEffect(() => {
    if (!store || !queue || !online || authRetried.current) return
    if (verifiedRole !== 'owner' && verifiedRole !== 'designer') return
    authRetried.current = true
    void (async () => {
      try {
        const candidates = authRetryCandidates(await store.list(), verifiedRole)
        if (!candidates.length) return
        setSending(true)
        for (const record of candidates) {
          const survey = MeasurementSurveySchema.parse(await store.getSurvey(record.action.entityId))
          await retryRejectedMeasurement(survey, record, store, queue, Date.now(), crypto.randomUUID())
        }
        setNetwork(queue.network)
        await refresh(store)
      } catch (error) {
        setMessage(t(mobileErrorMessage(error, 'Не удалось повторить отправку', navigator.onLine)))
      } finally { setSending(false) }
    })()
  }, [online, queue, refresh, store, verifiedRole])

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
      setMessage(t(mobileErrorMessage(error, 'Не удалось разрешить конфликт', navigator.onLine)))
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
      setMessage(t(mobileErrorMessage(error, 'Не удалось повторить отправку', navigator.onLine)))
    } finally { setSending(false) }
  }

  const createKitchen = async (survey: MeasurementSurvey, wall: WallId, tolerance: RoomTolerance) => {
    if (!store) throw new Error(t('Локальное хранилище недоступно'))
    await saveSurvey(survey)
    await handoffMeasurementToKitchen(survey, configuratorKitchenTarget((id, project) => store.putProject(id, project)), [wall], tolerance)
    router.push(`/configurator?measurement=${encodeURIComponent(survey.id)}`)
  }

  const connection = connectionState(online, network)
  const networkLabel = connection === 'offline' ? t('Нет сети') : connection === 'unreachable' ? t('Сервер недоступен') :
    sending ? t('Отправляется') : t('В сети')
  const networkColor = connection !== 'online' ? 'border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)]' : 'border-[#28723b] bg-[#e7f4e9] text-[#144c25]'
  const visibleMessage = visibleNetworkMessage(networkLabel, message, t('Сервер недоступен'), t('Нет сети'))

  if (active && store) return <MeasurementWizard initial={active} store={store} onBack={() => { setActive(null); void refresh(store) }} onSave={saveSurvey} onKitchen={createKitchen} pending={pending} networkLabel={networkLabel} networkColor={networkColor} />

  return <main className="site mx-auto min-h-dvh w-full max-w-xl overflow-x-hidden bg-[var(--panel)] p-4 text-[var(--ink)]">
    <div role="status" className={`mb-4 border p-3 text-sm ${networkColor}`}>
      {networkLabel} · {t('Ожидает отправки')}: {pending}
    </div>
    <p role="status" className="mb-4 border border-[var(--rule)] bg-[var(--paper)] p-3 text-sm">
      {durableStorage === 'granted' ? t('Постоянное хранение разрешено.') :
        durableStorage === 'denied' ? t('Постоянное хранение не разрешено браузером.') :
          durableStorage === 'unavailable' ? t('Постоянное хранение недоступно.') : t('Проверяем постоянное хранение…')}
    </p>
    {durableStorage !== 'granted' && (pending > 0 || surveys.length > 0) && <p role="status" className="mb-4 border border-[#a46a00] bg-[#fff3d5] p-3 text-sm text-[#5a3900]">
      {t('Данные замеров и фото пока только на этом телефоне. Сохраните копию после подключения к интернету.')}
      {' '}{durableStorage === 'denied' ? t('Постоянное хранение не разрешено браузером.') :
        durableStorage === 'unavailable' ? t('Постоянное хранение недоступно.') : t('Проверяем постоянное хранение…')}
      {offlineSince !== null && now - offlineSince >= 24 * 60 * 60 * 1000 && ` ${t('Вы давно офлайн. Подключитесь, чтобы отправить очередь.')}`}
    </p>}
    <header className="mb-6">
      {/* Қосымшаның атауы (бұрын «Тапсырыс» — жұмыс атауы еді). */}
      <p className="flex items-center gap-1.5 text-sm font-semibold tracking-wide" data-testid="brand">
        <img src="/brand/aismebel-mark.svg" width={18} height={18} alt="" aria-hidden="true" />
        {BRAND.name}
      </p>
      <h1 className="mt-1 text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{role === 'shop' ? t('Цех') : role === 'client' ? t('Клиент') : t('Сегодня')}</h1>
    </header>
    {!role && <div className="sheet p-4 text-sm">
      <p>{t('Для первого входа и проверки роли нужен интернет.')}</p>
      {online ? <Link className={`${button} mt-3`} href="/configurator">{t('Войти')}</Link> :
        <button className={`${button} mt-3`} type="button" disabled>{t('Войти')}</button>}
      <p className="mt-1 text-xs text-[var(--ink-soft)]">{t('Работает через интернет')}</p>
    </div>}
    {(role === 'owner' || role === 'designer') && <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('Следующее действие')}</h2>
      <button className={`${button} !border-[var(--brand-graphite)] !bg-[var(--brand-graphite)] !font-semibold !text-white`} type="button" disabled={!store}
        onClick={() => setActive(emptySurvey(crypto.randomUUID(), Date.now()))}>{t('Новый замер')}</button>
      <Link className={button} href="/configurator">{t('Новое КП')}</Link>
      {role === 'owner' && <Link className={button} href="/mobile/installation">{t('Монтаж')}</Link>}
      <h2 className="pt-2 text-base font-semibold">{t('Замеры на этом устройстве')}</h2>
      {surveys.length === 0 && <p className="sheet p-3 text-sm">{t('Пока нет сохранённых замеров')}</p>}
      {surveys.map((survey) => <button key={survey.id} className={button} type="button" onClick={() => setActive(survey)}>
        {measurementCaption(t('Замер'), survey.height.capturedAt)}
      </button>)}
    </section>}
    {role === 'shop' && <section className="space-y-3">
      <p className="sheet p-3 text-sm">{t('Работа цеха: сканирование деталей и монтаж.')}</p>
      <Link className={button} href="/mobile/scan">{t('Сканировать деталь')}</Link>
      <Link className={button} href="/mobile/installation">{t('Монтаж')}</Link>
    </section>}
    {role === 'client' && <section className="sheet p-3 text-sm">
      {t('Откройте ссылку на своё предложение от мастерской.')}
    </section>}
    {conflicts.map((record) => <section key={record.action.id} className="mt-4 border border-[#9b1c1c] bg-[var(--paper)] p-3 text-sm">
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
    {rejected.map((record) => <section key={record.action.id} className="mt-4 border border-[#9b1c1c] bg-[var(--paper)] p-3 text-sm">
      <h2 className="font-semibold">{t('Отправка замера отклонена')} · {record.action.entityId.slice(0, 8)}</h2>
      <p className="mt-1">{record.error ?? t('Проверьте вход и попробуйте снова')}</p>
      <button className={`${button} mt-2`} type="button" disabled={!online} onClick={() => void retryRejected(record)}>{t('Повторить отправку')}</button>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">{t('Работает через интернет')}</p>
    </section>)}
    {visibleMessage && <p role="alert" className="mt-4 border border-[#9b1c1c] bg-[var(--paper)] p-3 text-sm text-red-700 dark:text-red-300">{visibleMessage}</p>}
  </main>
}
