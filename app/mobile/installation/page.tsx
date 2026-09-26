'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/i18n'
import { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { createMobileSyncTransport } from '@/lib/mobile/syncTransport'
import { prepareMeasurementPhoto } from '@/lib/mobile/photo'
import { INSTALLATION_CHECKLIST, parseInstallationAction, type ChecklistKey, type InstallationActionKind, type InstallationTask } from '@/src/core/installation'
import { SyncQueue } from '@/src/core/sync/queue'
import type { JsonValue } from '@/src/core/sync/types'

const labels: Record<ChecklistKey, string> = {
  delivery: 'Доставка', assembly: 'Сборка', alignment: 'Выравнивание',
  cleaning: 'Уборка', acceptance: 'Приёмка',
}

async function imageData(file: File): Promise<string> {
  const blob = await prepareMeasurementPhoto(file)
  if (blob.size > 2_000_000) throw new Error(t('Фото акта слишком большое. Выберите другое.'))
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error(t('Фото не прочитано')))
    reader.onerror = () => reject(reader.error ?? new Error(t('Фото не прочитано')))
    reader.readAsDataURL(blob)
  })
}

export default function MobileInstallationPage() {
  const [db, setDb] = useState<IndexedDbMobileStore | null>(null)
  const [tasks, setTasks] = useState<InstallationTask[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [defectPanel, setDefectPanel] = useState('')
  const [defectNote, setDefectNote] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const task = tasks.find((item) => item.id === selected)

  const refresh = async (store: IndexedDbMobileStore) => {
    if (navigator.onLine) {
      const response = await fetch('/api/installation', { credentials: 'same-origin' })
      if (response.ok) {
        const data = await response.json() as { tasks: { id: string }[] }
        for (const item of data.tasks) {
          const detail = await fetch(`/api/installation/${encodeURIComponent(item.id)}`, { credentials: 'same-origin' })
          if (!detail.ok) continue
          const body = await detail.json() as { task: InstallationTask }
          await store.putInstallation(body.task)
        }
      }
    }
    setTasks(await store.listInstallations())
    setPending((await store.list()).some((item) => ['pending', 'conflict', 'rejected'].includes(item.status) && item.action.kind.startsWith('installation.')))
  }

  useEffect(() => {
    let alive = true
    let opened: IndexedDbMobileStore | undefined
    const init = async () => {
      setOnline(navigator.onLine)
      opened = await IndexedDbMobileStore.open()
      if (!alive) { opened.close(); return }
      opened.onVersionChange = () => window.location.reload()
      setDb(opened)
      await refresh(opened)
    }
    void init().catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('Монтаж недоступен')))
    return () => { alive = false; opened?.close() }
  }, [])

  useEffect(() => {
    if (!db || !selected) return
    void db.getInstallationDraft(selected).then((value) => setDraft(value ?? {}))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('Черновик недоступен')))
  }, [db, selected])

  useEffect(() => {
    if (!db) return
    const wentOnline = () => {
      setOnline(true)
      const queue = new SyncQueue(db, createMobileSyncTransport(db))
      void queue.setOnline(true, Date.now()).then(() => refresh(db))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('Не удалось отправить очередь')))
    }
    const wentOffline = () => setOnline(false)
    window.addEventListener('online', wentOnline)
    window.addEventListener('offline', wentOffline)
    return () => { window.removeEventListener('online', wentOnline); window.removeEventListener('offline', wentOffline) }
  }, [db])

  const saveDraft = async (next: Record<string, string>) => {
    if (!db || !selected) return
    await db.putInstallationDraft(selected, next)
    setDraft(next)
  }

  const capture = async (key: string, file?: File) => {
    if (!file) return
    setBusy(true)
    try { await saveDraft({ ...draft, [key]: await imageData(file) }); setMessage(t('Фото сохранено на этом устройстве')) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('Не удалось сохранить фото')) }
    finally { setBusy(false) }
  }

  const send = async (kind: InstallationActionKind, payload: JsonValue) => {
    if (!db || !task || pending) return
    setBusy(true)
    try {
      const action = parseInstallationAction({ id: crypto.randomUUID(), kind, entityId: task.id, payload,
        baseRevision: task.revision, createdAt: Date.now() })
      const queue = new SyncQueue(db, createMobileSyncTransport(db))
      await queue.setOnline(navigator.onLine, Date.now())
      await queue.enqueue(action)
      await refresh(db)
      setMessage(navigator.onLine ? t('Действие отправлено') : t('Действие сохранено в очереди этого телефона'))
    } catch (error) { setMessage(error instanceof Error ? error.message : t('Не удалось сохранить действие')) }
    finally { setBusy(false) }
  }

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const surface = canvas.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * surface.width / rect.width,
      y: (event.clientY - rect.top) * surface.height / rect.height }
  }

  return <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-[#f5f5f5] p-4 text-black">
    <Link href="/mobile" className="block border bg-white p-3">{t('Назад')}</Link>
    <h1 className="text-xl font-semibold">{t('Монтаж')}</h1>
    {!online && <p className="border bg-white p-3 text-sm">{t('Нет сети')}: {t('Данные и фото остаются на этом телефоне')}</p>}
    {pending && <p className="border bg-white p-3 text-sm">{t('Ожидает отправки')}: 1</p>}
    <div className="space-y-2">{tasks.map((item) => <button key={item.id} className="block min-h-12 w-full border bg-white p-3 text-left"
      onClick={() => setSelected(item.id)}>{item.id} · {item.status}</button>)}</div>
    {task && <section className="space-y-3 border bg-white p-3 text-sm">
      <h2 className="font-semibold">{task.id} · {task.projectId}</h2>
      {INSTALLATION_CHECKLIST.map((key) => <div key={key} className="border p-2">
        <p>{t(labels[key])}: {task.checklist[key].checked ? '✓' : '—'}</p>
        <input type="file" accept="image/*" capture="environment" aria-label={`${t(labels[key])}: ${t('Фото')}`}
          onChange={(event) => void capture(key, event.target.files?.[0])} />
        {draft[key] && <button className="mt-2 block border p-2" disabled={busy || pending || task.status === 'closed'}
          onClick={() => void send('installation.checklist', { key, checked: true,
            photo: { id: crypto.randomUUID(), dataUrl: draft[key]! } })}>{t('Подтвердить с фото')}</button>}
      </div>)}
      <p>{t('Подпись клиента на экране')}</p>
      <canvas ref={canvas} width={320} height={120} className="w-full touch-none border"
        onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event); if (p) { const ctx = canvas.current?.getContext('2d'); ctx?.beginPath(); ctx?.moveTo(p.x, p.y) } }}
        onPointerMove={(event) => { if (!drawing.current) return; const p = point(event); if (!p) return
          const ctx = canvas.current?.getContext('2d'); ctx?.lineTo(p.x, p.y); ctx?.stroke() }}
        onPointerUp={() => { drawing.current = false; const dataUrl = canvas.current?.toDataURL('image/png')
          if (dataUrl) void saveDraft({ ...draft, signature: dataUrl }) }} />
      <button className="block border p-2" disabled={busy || pending || task.status === 'closed' || !draft.signature}
        onClick={() => void send('installation.signature', { signature: { id: crypto.randomUUID(), dataUrl: draft.signature! } })}>{t('Сохранить подпись')}</button>
      <div className="space-y-2 border p-2">
        <h3 className="font-semibold">{t('Акт о дефекте')}</h3>
        <select className="min-h-11 w-full border p-2" value={defectPanel} onChange={(event) => setDefectPanel(event.target.value)}>
          <option value="">{t('Выберите деталь')}</option>
          {task.panelIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <textarea className="w-full border p-2" value={defectNote} onChange={(event) => setDefectNote(event.target.value)}
          placeholder={t('Описание дефекта')} />
        <input type="file" accept="image/*" capture="environment" aria-label={t('Фото дефекта')}
          onChange={(event) => void capture('defectPhoto', event.target.files?.[0])} />
        <button className="block border p-2" disabled={busy || pending || !defectPanel || !defectNote.trim() || !draft.defectPhoto}
          onClick={() => void send('installation.defect', { id: crypto.randomUUID(), panelId: defectPanel,
            note: defectNote, photo: { id: crypto.randomUUID(), dataUrl: draft.defectPhoto! } })}>{t('Создать ремонтное задание')}</button>
      </div>
      {task.repairs.filter((repair) => repair.status === 'open').map((repair) => <button key={repair.id}
        className="block border p-2" disabled={busy || pending} onClick={() => void send('installation.repairComplete', { repairId: repair.id })}>
        {t('Ремонт завершён')}: {repair.panelId}</button>)}
      <button className="block border p-2" disabled={busy || pending || task.status === 'closed'}
        onClick={() => void send('installation.close', {})}>{t('Завершить монтаж')}</button>
      {task.repairs.some((repair) => repair.status === 'open') && <p>{t('Есть открытые ремонтные задания')}</p>}
    </section>}
    {message && <p role="status" className="border bg-white p-3 text-sm">{message}</p>}
  </main>
}
