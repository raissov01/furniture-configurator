import { useCallback, useEffect, useState } from 'react'
import { applySavedLang, getLang, LANGS, setLang, t } from '@/lib/i18n'
import { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { createMobileSyncTransport } from '@/lib/mobile/syncTransport'
import { MeasurementWizard } from '@/components/mobile/MeasurementWizard'
import { emptySurvey, parseSavedMeasurementDraft } from '@/components/mobile/measurementModel'
import { offlineShellNext, pendingMeasurementCount, saveOfflineMeasurement, surveySyncState, type SurveySyncState } from '@/components/mobile/offlineHandoff'
import { SyncQueue } from '@/src/core/sync/queue'
import type { MeasurementSurvey } from '@/src/core/measure'
import type { SyncRecord } from '@/src/core/sync/types'

declare const __AISMEBEL_START_URL__: string
declare const __AISMEBEL_HEALTH_URL__: string

const button = 'min-h-12 w-full border border-[#8c8c8c] bg-white px-4 py-3 text-left text-black disabled:cursor-not-allowed disabled:opacity-50'
const PROBE_MS = 15_000
const AUTO_OPEN_KEY = 'aismebel:auto-online-at'

function lastAutoOpenAt(): number | null {
  try {
    const value = Number(sessionStorage.getItem(AUTO_OPEN_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch { return null }
}

const stateLabel: Record<SurveySyncState, string> = {
  local: 'Только на устройстве', pending: 'Ожидает отправки', sent: 'Отправлено',
  conflict: 'Конфликт замера', rejected: 'Отправка замера отклонена',
}

/** Сервер 2xx қайтарса ғана «байланыс бар»; кэш пен ескі жауап есептелмейді. */
async function serverReachable(): Promise<boolean> {
  if (!navigator.onLine) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(__AISMEBEL_HEALTH_URL__, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
    return response.ok
  } catch { return false } finally { clearTimeout(timer) }
}

/**
 * Гибрид қосымшаның офлайн беті (Capacitor `errorPath`). Сервер origin-інде
 * ашылады, сондықтан толық `/mobile`-мен бір IndexedDB мен бір синхрон кезегін
 * бөліседі: мұнда тек кезекке қоямыз, жібереді — кірген пайдаланушының `/mobile` беті.
 */
export function NativeMeasurementApp() {
  const [db, setDb] = useState<IndexedDbMobileStore | null>(null)
  const [queue, setQueue] = useState<SyncQueue | null>(null)
  const [surveys, setSurveys] = useState<MeasurementSurvey[]>([])
  const [records, setRecords] = useState<SyncRecord[]>([])
  const [active, setActive] = useState<MeasurementSurvey | null>(null)
  const [language, setLanguage] = useState(getLang())
  const [message, setMessage] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [reachable, setReachable] = useState(false)

  const refresh = useCallback(async (store: IndexedDbMobileStore) => {
    const values = await store.listSurveys()
    setSurveys(values.flatMap((value) => {
      const parsed = parseSavedMeasurementDraft(value)
      return parsed ? [parsed] : []
    }))
    setRecords(await store.list())
  }, [])

  useEffect(() => {
    applySavedLang()
    setLanguage(getLang())
    let alive = true
    let opened: IndexedDbMobileStore | undefined
    void IndexedDbMobileStore.open().then(async (store) => {
      if (!alive) { store.close(); return }
      opened = store
      store.onVersionChange = () => { if (alive) setMessage(t('Хранилище обновилось. Перезапустите приложение.')) }
      await refresh(store)
      // Кезек `network`-ті ешқашан 'online' етпейміз: бұл бет желіге ештеңе жібермейді.
      if (alive) { setQueue(new SyncQueue(store, createMobileSyncTransport(store))); setDb(store) }
    }).catch((error: unknown) => {
      if (alive) setMessage(error instanceof Error ? error.message : t('Локальное хранилище недоступно'))
    })
    return () => { alive = false; opened?.close() }
  }, [refresh])

  useEffect(() => {
    let alive = true
    const probe = async () => {
      const ok = await serverReachable()
      if (alive) { setOnline(navigator.onLine); setReachable(ok) }
    }
    const change = () => { setOnline(navigator.onLine); void probe() }
    void probe()
    const timer = setInterval(() => void probe(), PROBE_MS)
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
    }
  }, [])

  const openOnline = useCallback(() => { window.location.replace(__AISMEBEL_START_URL__) }, [])

  useEffect(() => {
    const now = Date.now()
    if (offlineShellNext({ browserOnline: online, serverReachable: reachable, editing: active !== null,
      lastAutoOpenAt: lastAutoOpenAt(), now }) !== 'open-online') return
    try { sessionStorage.setItem(AUTO_OPEN_KEY, String(now)) } catch { /* Қорғаныс тек осы сессияда. */ }
    openOnline()
  }, [active, online, openOnline, reachable])

  const pending = pendingMeasurementCount(records)
  const networkLabel = reachable ? t('В сети') : online ? t('Сервер недоступен') : t('Нет сети')

  if (!db || !queue) return <main className="min-h-dvh bg-[#f5f5f5] p-4 text-black">
    <h1 className="text-xl font-semibold">AisMebel</h1>
    <p role="status">{message || t('Открываем локальные замеры…')}</p>
  </main>

  if (active) return <MeasurementWizard key={active.id} initial={active} store={db} pending={pending}
    networkLabel={networkLabel} networkColor="border-[#8c8c8c] bg-white"
    onBack={() => { void refresh(db).then(() => setActive(null)).catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('Не удалось открыть замеры'))) }}
    onSave={async (survey) => {
      const result = await saveOfflineMeasurement(survey, db, queue, Date.now(), crypto.randomUUID())
      await refresh(db)
      return result
    }} />

  return <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-[#f5f5f5] p-4 text-black">
    <div role="status" className="border border-[#8c8c8c] bg-white p-3 text-sm">
      {networkLabel} · {t('Ожидает отправки')}: {pending}
    </div>
    <h1 className="text-xl font-semibold">AisMebel · {t('Замеры')}</h1>
    <label className="block text-sm">{t('Язык')}
      <select className={`${button} mt-1`} value={language} onChange={(event) => {
        const next = LANGS.find((entry) => entry.value === event.target.value)?.value
        if (next) { setLang(next); setLanguage(next) }
      }}>{LANGS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
    </label>
    <p className="border border-[#8c8c8c] bg-white p-3 text-sm">
      {t('Замеры и фото хранятся в данных приложения на этом устройстве.')}{' '}
      {t('Когда появится интернет, войдите в аккаунт — замеры отправятся автоматически.')}
    </p>
    <button className={button} type="button" onClick={() => setActive(emptySurvey(crypto.randomUUID(), Date.now()))}>
      {t('Новый замер')}
    </button>
    <h2 className="font-semibold">{t('Замеры на этом устройстве')}</h2>
    {surveys.length === 0 && <p className="text-sm">{t('Пока нет замеров')}</p>}
    {surveys.map((survey) => <button key={survey.id} className={button} type="button" onClick={() => setActive(survey)}>
      {new Date(survey.height.capturedAt).toLocaleString()} · {t(stateLabel[surveySyncState(records, survey.id)])}
    </button>)}
    <section className="space-y-2 border border-[#8c8c8c] bg-white p-3 text-sm">
      <h2 className="font-semibold">{t('Полная версия')}</h2>
      <p>{t('Заказы, КП, код клиента, монтаж и сканирование QR')}</p>
      <button className={button} type="button" disabled={!online} onClick={openOnline}>{t('Открыть полную версию')}</button>
      <p className="text-xs text-[#525252]">{t('Работает через интернет')}</p>
    </section>
    {message && <p role="status" className="border border-[#8c8c8c] bg-white p-3 text-sm">{message}</p>}
  </main>
}
