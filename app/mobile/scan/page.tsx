'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/i18n'
import { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { parseProjectV4 } from '@/src/core/projectV4'
import { flattenTree } from '@/src/core/flatten'
import { projectProduction } from '@/lib/projectProduction'
import { decodePartQr, type PartQr } from '@/src/core/partQr'
import { scanVersionStatus } from '@/lib/mobile/partScanUi'
import type { InstallationTask } from '@/src/core/installation'
import type { Panel } from '@/src/core/types'

type Detector = { detect(video: HTMLVideoElement): Promise<{ rawValue: string }[]> }
type DetectorClass = new (options: { formats: string[] }) => Detector

export default function MobileScanPage() {
  const video = useRef<HTMLVideoElement>(null)
  const scanRequest = useRef(0)
  const [raw, setRaw] = useState('')
  const [part, setPart] = useState<PartQr | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [message, setMessage] = useState('')
  const [camera, setCamera] = useState(false)

  const openCode = async (value: string) => {
    const request = ++scanRequest.current
    setPart(null)
    setPanel(null)
    setMessage('')
    try {
      const decoded = decodePartQr(value.trim())
      const db = await IndexedDbMobileStore.open()
      try {
        let tasks = (await db.listInstallations()).filter((task) => task.projectId === decoded.projectId)
        if (navigator.onLine) {
          const list = await fetch('/api/installation', { credentials: 'same-origin', cache: 'no-store' })
          if (!list.ok) throw new Error(t('Монтаж нұсқасы тексерілмеді. Қайта қосылып көріңіз.'))
          const listing = await list.json() as { tasks: { id: string; projectId: string }[] }
          const fresh: InstallationTask[] = []
          for (const item of listing.tasks.filter((entry) => entry.projectId === decoded.projectId)) {
            const detail = await fetch(`/api/installation/${encodeURIComponent(item.id)}`, { credentials: 'same-origin', cache: 'no-store' })
            if (!detail.ok) throw new Error(t('Монтаж нұсқасы тексерілмеді. Қайта қосылып көріңіз.'))
            const body = await detail.json() as { task: InstallationTask }
            await db.putInstallation(body.task)
            fresh.push(body.task)
          }
          tasks = fresh
        }
        const version = scanVersionStatus(decoded, tasks)
        if (request !== scanRequest.current) return
        setPart(decoded)
        if (version === 'stale') { setMessage(t('Бұл бирка ескірген. Жөндеуден кейінгі жаңа QR-ді пайдаланыңыз.')); return }
        if (version === 'unknown' && tasks.some((task) => task.panelIds.includes(decoded.panelId))) {
          setMessage(t('Бирка нұсқасы монтаж тапсырмасымен сәйкес емес.')); return
        }
        let project = await db.getProject(decoded.projectId)
        if (navigator.onLine) {
          const response = await fetch(`/api/projects/${encodeURIComponent(decoded.projectId)}`, { credentials: 'same-origin' })
          if (!response.ok) throw new Error(t('Жобаның жаңа нұсқасы тексерілмеді. Қайта қосылып көріңіз.'))
          const body: unknown = await response.json()
          if (!body || typeof body !== 'object' || !('project' in body)) throw new Error(t('Жоба жауабы жарамсыз'))
          project = parseProjectV4(body.project)
          await db.putProject(decoded.projectId, project)
        }
        if (!project) { setMessage(t('Проект не загружен на телефон. Откройте его при наличии сети.')); return }
        const scene = flattenTree(project.root, { materials: project.materials, edgeBands: project.edgeBands },
          project.settings, project.layers, project.autoJoints)
        const found = projectProduction(project.root, scene).panels.find((item) => item.id === decoded.panelId)
        if (!found) throw new Error(t('Деталь не найдена в проекте'))
        if (request !== scanRequest.current) return
        setPanel(found)
        setMessage(version === 'unknown' ? t('Бұл жобаға монтаж тапсырмасы жоқ: QR нұсқасы расталмады.') :
          navigator.onLine ? '' : t('Офлайн: соңғы сервер нұсқасы тексерілмеді.'))
      } finally { db.close() }
    } catch (error) { if (request === scanRequest.current) {
      setPart(null); setPanel(null); setMessage(error instanceof Error ? error.message : t('QR не прочитан'))
    } }
  }

  useEffect(() => {
    if (!camera) return
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    let disposed = false
    const run = async () => {
      const Detector = (window as Window & { BarcodeDetector?: DetectorClass }).BarcodeDetector
      if (!Detector) throw new Error(t('Сканер камеры недоступен. Введите код вручную.'))
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (disposed) { stream.getTracks().forEach((track) => track.stop()); return }
      if (!video.current) throw new Error(t('Камера недоступна'))
      video.current.srcObject = stream
      await video.current.play()
      const detector = new Detector({ formats: ['qr_code'] })
      timer = setInterval(() => {
        if (!video.current || disposed) return
        void detector.detect(video.current).then((codes) => {
          if (codes[0]) { setRaw(codes[0].rawValue); setCamera(false); void openCode(codes[0].rawValue) }
        }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('QR не прочитан')))
      }, 400)
    }
    void run().catch((error: unknown) => { setMessage(error instanceof Error ? error.message : t('Камера недоступна')); setCamera(false) })
    return () => { disposed = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()) }
  }, [camera])

  return <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-[#f5f5f5] p-4 text-black">
    <Link href="/mobile" className="block border bg-white p-3">{t('Назад')}</Link>
    <h1 className="text-xl font-semibold">{t('Сканировать деталь')}</h1>
    <label className="block text-sm">{t('Код бирки')}
      <input className="mt-1 min-h-12 w-full border bg-white p-3" value={raw} onChange={(event) => setRaw(event.target.value)} />
    </label>
    <button className="min-h-12 w-full border bg-white p-3 text-left" onClick={() => void openCode(raw)}>{t('Найти деталь')}</button>
    <button className="min-h-12 w-full border bg-white p-3 text-left" onClick={() => setCamera(!camera)}>{camera ? t('Закрыть камеру') : t('Открыть камеру')}</button>
    {camera && <video ref={video} playsInline muted className="w-full" />}
    {part && <section className="border bg-white p-3 text-sm">
      <p>{t('Проект')}: {part.projectId}</p><p>{t('Деталь')}: {part.panelId}</p><p>{t('Версия')}: {part.version}</p>
      {panel && <>
        <p className="font-semibold">{panel.label}</p>
        <p>{t('Готовый')}: {panel.finishedLength} × {panel.finishedWidth} мм</p>
        <p>{t('Рез')}: {panel.cutLength} × {panel.cutWidth} мм</p>
        <p>{t('Кромка')}: {Object.entries(panel.edges).filter(([, edge]) => edge !== null).map(([side]) => side).join(', ') || '—'}</p>
        <p>{t('Присадка')}: {panel.drilling.length}</p>
      </>}
    </section>}
    {message && <p role="status" className="border bg-white p-3 text-sm">{message}</p>}
  </main>
}
