'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LocalizedFileChooser } from '@/components/LocalizedFileChooser'
import { t } from '@/lib/i18n'
import { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { createMobileSyncTransport } from '@/lib/mobile/syncTransport'
import { prepareMeasurementPhoto } from '@/lib/mobile/photo'
import { canEditInstallation, closeBlockReason, installationQueueNotice, signatureHasStroke } from '@/lib/mobile/installationUi'
import { installationCreateAction } from '@/lib/installationHandoff'
import { printableRepairs } from '@/lib/mobile/repairLabel'
import { INSTALLATION_CHECKLIST, parseInstallationAction, type ChecklistKey, type InstallationActionKind, type InstallationTask } from '@/src/core/installation'
import { SyncQueue } from '@/src/core/sync/queue'
import type { JsonValue } from '@/src/core/sync/types'
import type { SyncRecord } from '@/src/core/sync/types'

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
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [blockedRecords, setBlockedRecords] = useState<SyncRecord[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [defectPanel, setDefectPanel] = useState('')
  const [defectNote, setDefectNote] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const strokes = useRef(0)
  const task = tasks.find((item) => item.id === selected)

  const refresh = async (store: IndexedDbMobileStore) => {
    if (navigator.onLine) {
      const projectsResponse = await fetch('/api/projects', { credentials: 'same-origin', cache: 'no-store' })
      if (projectsResponse.ok) {
        const projectBody = await projectsResponse.json() as { projects: { id: string; name: string }[] }
        setProjects(projectBody.projects)
      }
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
    const records = (await store.list()).filter((item) => item.action.kind.startsWith('installation.') && item.status !== 'sent' && item.status !== 'superseded')
    setBlockedRecords(records.filter((item) => item.status === 'rejected' || item.status === 'conflict'))
    setPending(records.length > 0)
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
      const requestedTask = new URLSearchParams(window.location.search).get('task')
      if (requestedTask) setSelected(requestedTask)
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
      const record = await queue.enqueue(action)
      await refresh(db)
      setMessage(installationQueueNotice(record.status, record.error ?? '', t))
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

  const discardBlocked = async (record: SyncRecord) => {
    if (!db) return
    await db.update({ ...record, status: 'superseded' })
    await refresh(db)
    setMessage(t('Действие удалено из очереди. Исправьте данные и повторите.'))
  }

  const startTask = async (projectId: string) => {
    if (!db || pending || busy || !navigator.onLine) return
    setBusy(true)
    try {
      const action = installationCreateAction(projectId, crypto.randomUUID(), crypto.randomUUID(), Date.now())
      const response = await fetch('/api/installation/sync', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
      const body = await response.json() as { kind?: string; error?: string }
      if (!response.ok || body.kind !== 'applied') throw new Error(body.error ?? t('Не удалось создать монтажное задание'))
      await refresh(db)
      setSelected(action.entityId)
      setMessage(t('Монтажное задание открыто'))
    } catch (error) { setMessage(error instanceof Error ? error.message : t('Не удалось создать монтажное задание')) }
    finally { setBusy(false) }
  }

  return <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-[#f5f5f5] p-4 text-black">
    <Link href="/mobile" className="block border bg-white p-3">{t('Назад')}</Link>
    <h1 className="text-xl font-semibold">{t('Монтаж')}</h1>
    {!online && <p className="border bg-white p-3 text-sm">{t('Нет сети')}: {t('Данные и фото остаются на этом телефоне')}</p>}
    {pending && <p className="border bg-white p-3 text-sm">{t('Ожидает отправки')}: {blockedRecords.length || 1}</p>}
    {blockedRecords.map((record) => <div key={record.action.id} role="alert" className="border border-red-700 bg-white p-3 text-sm">
      <p>{installationQueueNotice(record.status, record.error ?? '', t)}</p>
      <button className="mt-2 min-h-11 border p-2" onClick={() => void discardBlocked(record)}>{t('Удалить действие из очереди')}</button>
    </div>)}
    {online && projects.some((project) => !tasks.some((item) => item.projectId === project.id)) && <section className="space-y-2 border bg-white p-3 text-sm">
      <h2 className="font-semibold">{t('Сохранённые проекты для монтажа')}</h2>
      {projects.filter((project) => !tasks.some((item) => item.projectId === project.id)).map((project) =>
        <div key={project.id} className="flex flex-wrap items-center gap-2 border p-2">
          <span className="min-w-0 flex-1 break-words">{project.name}</span>
          <button className="min-h-11 max-w-full border p-2" disabled={busy || pending} onClick={() => void startTask(project.id)}>
            {t('Отправить в производство → открыть монтаж')}
          </button>
        </div>)}
    </section>}
    <div className="space-y-2">{tasks.map((item) => <button key={item.id} className="block min-h-12 w-full border bg-white p-3 text-left"
      onClick={() => setSelected(item.id)}>{item.id} · {item.status}</button>)}</div>
    {task && <section className="space-y-3 border bg-white p-3 text-sm">
      <h2 className="font-semibold">{task.id} · {task.projectId}</h2>
      {INSTALLATION_CHECKLIST.map((key) => <div key={key} className="border p-2">
        <p>{t(labels[key])}: {task.checklist[key].checked ? '✓' : '—'}</p>
        <label className="block"><LocalizedFileChooser accept="image/*" capture="environment" disabled={!canEditInstallation(task)}
          ariaLabel={`${t(labels[key])}: ${t('Фото')}`} caption="Выбрать фото"
          onChange={(event) => void capture(key, event.target.files?.[0])} /></label>
        {draft[key] && <button className="mt-2 block border p-2" disabled={busy || pending || task.status === 'closed'}
          onClick={() => void send('installation.checklist', { key, checked: true,
            photo: { id: crypto.randomUUID(), dataUrl: draft[key]! } })}>{t('Подтвердить с фото')}</button>}
      </div>)}
      <p>{t('Подпись клиента на экране')}</p>
      <canvas ref={canvas} width={320} height={120} className="w-full touch-none border"
        onPointerDown={(event) => { if (!canEditInstallation(task)) return; drawing.current = true; strokes.current = 0;
          setDraft((current) => ({ ...current, signature: '' }));
          canvas.current?.getContext('2d')?.clearRect(0, 0, 320, 120);
          event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event); lastPoint.current = p ?? null;
          if (p) { const ctx = canvas.current?.getContext('2d'); ctx?.beginPath(); ctx?.moveTo(p.x, p.y) } }}
        onPointerMove={(event) => { if (!drawing.current) return; const p = point(event); if (!p) return
          if (lastPoint.current && Math.hypot(p.x - lastPoint.current.x, p.y - lastPoint.current.y) < 2) return
          const ctx = canvas.current?.getContext('2d'); ctx?.lineTo(p.x, p.y); ctx?.stroke(); strokes.current++; lastPoint.current = p }}
        onPointerUp={() => { drawing.current = false; const dataUrl = canvas.current?.toDataURL('image/png')
          void saveDraft({ ...draft, signature: dataUrl && signatureHasStroke(strokes.current) ? dataUrl : '' }) }} />
      <button className="block border p-2" disabled={busy || pending || task.status === 'closed' || !draft.signature}
        onClick={() => void send('installation.signature', { signature: { id: crypto.randomUUID(), dataUrl: draft.signature! } })}>{t('Сохранить подпись')}</button>
      <div className="space-y-2 border p-2">
        <h3 className="font-semibold">{t('Акт о дефекте')}</h3>
        <select className="min-h-11 w-full border p-2" disabled={!canEditInstallation(task)} value={defectPanel} onChange={(event) => setDefectPanel(event.target.value)}>
          <option value="">{t('Выберите деталь')}</option>
          {task.panelIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <textarea className="w-full border p-2" disabled={!canEditInstallation(task)} value={defectNote} onChange={(event) => setDefectNote(event.target.value)}
          placeholder={t('Описание дефекта')} />
        <label className="block"><LocalizedFileChooser accept="image/*" capture="environment" disabled={!canEditInstallation(task)}
          ariaLabel={t('Фото дефекта')} caption="Выбрать фото"
          onChange={(event) => void capture('defectPhoto', event.target.files?.[0])} /></label>
        <button className="block border p-2" disabled={busy || pending || !canEditInstallation(task) || !defectPanel || !defectNote.trim() || !draft.defectPhoto}
          onClick={() => void send('installation.defect', { id: crypto.randomUUID(), panelId: defectPanel,
            note: defectNote, photo: { id: crypto.randomUUID(), dataUrl: draft.defectPhoto! } })}>{t('Создать ремонтное задание')}</button>
      </div>
      {task.repairs.filter((repair) => repair.status === 'open').map((repair) => <button key={repair.id}
        className="block border p-2" disabled={busy || pending || !canEditInstallation(task)} onClick={() => void send('installation.repairComplete', { repairId: repair.id })}>
        {t('Ремонт завершён')}: {repair.panelId}</button>)}
      {printableRepairs(task).map((repair) =>
        <Link key={repair.id} className="block min-h-11 border p-2" href={`/mobile/installation/label?task=${encodeURIComponent(task.id)}&repair=${encodeURIComponent(repair.id)}`}>
          {t('Напечатать новую бирку QR')}: {repair.panelId} · v{repair.labelVersion}
        </Link>)}
      <button className="block border p-2" disabled={busy || pending || closeBlockReason(task) !== null}
        onClick={() => void send('installation.close', {})}>{t('Завершить монтаж')}</button>
      {closeBlockReason(task) && <p role="status">{closeBlockReason(task, t)}</p>}
      {task.repairs.some((repair) => repair.status === 'open') && <p>{t('Есть открытые ремонтные задания')}</p>}
    </section>}
    {message && <p role="status" className="border bg-white p-3 text-sm">{message}</p>}
  </main>
}
