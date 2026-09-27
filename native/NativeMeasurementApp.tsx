import { useEffect, useState } from 'react'
import { applySavedLang, getLang, LANGS, setLang, t } from '@/lib/i18n'
import { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { MeasurementWizard } from '@/components/mobile/MeasurementWizard'
import { emptySurvey, parseSavedMeasurementDraft } from '@/components/mobile/measurementModel'
import type { MeasurementSurvey } from '@/src/core/measure'
import type { JsonValue } from '@/src/core/sync/types'

const button = 'min-h-12 w-full border border-[#8c8c8c] bg-white px-4 py-3 text-left text-black'

/** Local Capacitor entry. The same measurement UI and IndexedDB schema power the web route. */
export function NativeMeasurementApp() {
  const [db, setDb] = useState<IndexedDbMobileStore | null>(null)
  const [surveys, setSurveys] = useState<MeasurementSurvey[]>([])
  const [active, setActive] = useState<MeasurementSurvey | null>(null)
  const [language, setLanguage] = useState(getLang())
  const [message, setMessage] = useState('')

  const refresh = async (store: IndexedDbMobileStore) => {
    const values = await store.listSurveys()
    setSurveys(values.flatMap((value) => {
      const parsed = parseSavedMeasurementDraft(value)
      return parsed ? [parsed] : []
    }))
  }

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
      if (alive) setDb(store)
    }).catch((error: unknown) => {
      if (alive) setMessage(error instanceof Error ? error.message : t('Локальное хранилище недоступно'))
    })
    return () => { alive = false; opened?.close() }
  }, [])

  if (!db) return <main className="min-h-dvh bg-[#f5f5f5] p-4 text-black">
    <h1 className="text-xl font-semibold">AisMebel</h1>
    <p role="status">{message || t('Открываем локальные замеры…')}</p>
  </main>

  if (active) return <MeasurementWizard key={active.id} initial={active} store={db} pending={0}
    networkLabel={t('Только на устройстве')} networkColor="border-[#8c8c8c] bg-white"
    onBack={() => { void refresh(db).then(() => setActive(null)).catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('Не удалось открыть замеры'))) }}
    onSave={async (survey) => {
      await db.putSurvey(survey.id, survey as unknown as JsonValue)
      await refresh(db)
      return 'local'
    }} />

  return <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-[#f5f5f5] p-4 text-black">
    <h1 className="text-xl font-semibold">AisMebel · {t('Замеры')}</h1>
    <label className="block text-sm">{t('Язык')}
      <select className={`${button} mt-1`} value={language} onChange={(event) => {
        const next = LANGS.find((entry) => entry.value === event.target.value)?.value
        if (next) { setLang(next); setLanguage(next) }
      }}>{LANGS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
    </label>
    <p className="border border-[#8c8c8c] bg-white p-3 text-sm">{t('Замеры и фото хранятся в данных приложения на этом устройстве.')}</p>
    <button className={button} type="button" onClick={() => setActive(emptySurvey(crypto.randomUUID(), Date.now()))}>
      {t('Новый замер')}
    </button>
    <h2 className="font-semibold">{t('Замеры на этом устройстве')}</h2>
    {surveys.length === 0 && <p className="text-sm">{t('Пока нет замеров')}</p>}
    {surveys.map((survey) => <button key={survey.id} className={button} type="button" onClick={() => setActive(survey)}>
      {new Date(survey.height.capturedAt).toLocaleString()} · {survey.id}
    </button>)}
    {message && <p role="status" className="border border-[#8c8c8c] bg-white p-3 text-sm">{message}</p>}
  </main>
}
