'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import qrcode from 'qrcode-generator'
import { t } from '@/lib/i18n'
import { printableRepairQr } from '@/lib/mobile/repairLabel'
import type { InstallationTask } from '@/src/core/installation'

export default function RepairLabelPage() {
  const [task, setTask] = useState<InstallationTask | null>(null)
  const [repairId, setRepairId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const taskId = params.get('task') ?? ''
    const selectedRepair = params.get('repair') ?? ''
    if (!taskId || !selectedRepair) { setError(t('Укажите монтаж и ремонт для бирки')); return }
    setRepairId(selectedRepair)
    void fetch(`/api/installation/${encodeURIComponent(taskId)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { task?: InstallationTask; error?: string }
        if (!response.ok || !body.task) throw new Error(body.error ?? t('Монтажное задание не найдено'))
        printableRepairQr(body.task, selectedRepair)
        setTask(body.task)
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t('Бирка недоступна')))
  }, [])

  const repair = task?.repairs.find((item) => item.id === repairId)
  const qr = useMemo(() => {
    if (!task || !repair) return null
    const code = printableRepairQr(task, repairId)
    const matrix = qrcode(0, 'M')
    matrix.addData(code)
    matrix.make()
    const size = matrix.getModuleCount()
    return { size, cells: Array.from({ length: size * size }, (_, index) => {
      const x = index % size
      const y = Math.floor(index / size)
      return matrix.isDark(y, x) ? { x, y } : null
    }).filter((cell): cell is { x: number; y: number } => cell !== null) }
  }, [task, repair, repairId])

  return <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-white p-4 text-black">
    <style>{'@media print { .no-print { display: none !important; } main { max-width: none !important; padding: 0 !important; } }'}</style>
    <Link className="no-print block min-h-11 border p-2" href="/mobile/installation">{t('Назад')}</Link>
    {error && <p role="alert" className="border border-red-700 p-3">{error}</p>}
    {repair && qr && <section className="mx-auto w-fit max-w-full space-y-3 border p-4 text-center">
      <h1 className="text-lg font-semibold">{t('Новая бирка после ремонта')}</h1>
      <p className="break-all text-sm">{repair.panelId} · v{repair.labelVersion}</p>
      <svg role="img" aria-label={t('QR новой бирки')} className="mx-auto h-64 w-64 max-w-full" viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`} shapeRendering="crispEdges">
        <rect x={-4} y={-4} width={qr.size + 8} height={qr.size + 8} fill="white" />
        {qr.cells.map((cell) => <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={1} height={1} fill="black" />)}
      </svg>
      <p className="break-all text-xs">{task?.projectId}</p>
    </section>}
    {repair && qr && <button className="no-print min-h-11 w-full border p-2" onClick={() => window.print()}>{t('Напечатать бирку')}</button>}
  </main>
}
