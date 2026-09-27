'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button, Select } from '@/components/ui'
import { polygonCommitResult, polygonDraftResult } from '@/lib/f32PolygonDraft'
import type { PolygonPointDraft } from '@/lib/f32PolygonDraft'
import type { BoardSpec, Catalog } from '@/src/core/index'

function initialPoints(board: BoardSpec): PolygonPointDraft[] {
  return (board.contour?.points ?? [
    { x: 0, y: 0 }, { x: board.length, y: 0 },
    { x: board.length, y: board.width }, { x: 0, y: board.width },
  ]).map(({ x, y }) => ({ x: String(x), y: String(y) }))
}

export function PolygonEditor({ board, catalog, onApply }: {
  board: BoardSpec; catalog: Catalog; onApply: (patch: Partial<BoardSpec>) => void
}) {
  const [open, setOpen] = useState(Boolean(board.contour))
  const [points, setPoints] = useState<PolygonPointDraft[]>(() => initialPoints(board))
  const [bands, setBands] = useState<string[]>(() => board.contour?.bands.map((band) => band?.bandId ?? '') ?? ['', '', '', ''])
  const [commitError, setCommitError] = useState<string | null>(null)
  useEffect(() => {
    setPoints(initialPoints(board))
    setBands(board.contour?.bands.map((band) => band?.bandId ?? '') ?? ['', '', '', ''])
    setOpen(Boolean(board.contour))
    setCommitError(null)
  }, [board.contour, board.length, board.width])

  if (!open) return <Button onClick={() => setOpen(true)}>{tr('Создать контур')}</Button>
  const result = polygonDraftResult(points, bands, board.length, board.width, catalog)
  const error = commitError ?? result.error
  const updatePoint = (index: number, axis: 'x' | 'y', value: string) => {
    setPoints(points.map((point, i) => i === index ? { ...point, [axis]: value } : point))
    setCommitError(null)
  }
  return <div className="space-y-2 border border-neutral-300 p-2 dark:border-neutral-700" data-testid="polygon-editor">
    <p className="font-medium">{tr('Контур')}: {board.length} × {board.width} {tr('мм')}</p>
    <p className="text-[11px] text-neutral-600 dark:text-neutral-300">{tr('Точки идут по периметру; кромка относится к отрезку до следующей точки.')}</p>
    <div className="max-h-64 space-y-1 overflow-y-auto">
      {points.map((point, index) => <div key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-1 sm:grid-cols-[1.5rem_1fr_1fr_2fr_auto]">
        <span className="self-center">{index + 1}</span>
        {(['x', 'y'] as const).map((axis) => <input key={axis} type="text" inputMode="numeric"
          aria-label={`contour.points[${index}].${axis}`} aria-invalid={Boolean(error?.includes(`points[${index}].${axis}`)) || undefined}
          value={point[axis]} onChange={(event) => updatePoint(index, axis, event.target.value)}
          className={`min-w-0 border bg-white px-1 py-1 text-xs dark:bg-neutral-900 ${error?.includes(`points[${index}].${axis}`) ? 'border-red-600' : 'border-neutral-300 dark:border-neutral-700'}`} />)}
        <div className="col-span-3 sm:col-span-1"><Select value={bands[index] ?? ''} onChange={(bandId) => {
          setBands(bands.map((band, i) => i === index ? bandId : band))
          setCommitError(null)
        }} options={[{ value: '', label: tr('Нет кромки') }, ...catalog.edgeBands.map((band) => ({ value: band.id, label: band.name }))]} /></div>
        <div className="col-span-3 sm:col-span-1"><Button disabled={points.length <= 3} onClick={() => {
          setPoints(points.filter((_, i) => i !== index))
          setBands(bands.filter((_, i) => i !== index))
          setCommitError(null)
        }}>{tr('Удалить вершину')}</Button></div>
      </div>)}
    </div>
    {error && <p role="alert" className="border border-red-600 p-1 text-red-700 dark:text-red-400">{error}</p>}
    <div className="flex flex-wrap gap-1">
      <Button onClick={() => {
        setPoints([...points, { x: String(Math.round(board.length / 2)), y: String(Math.round(board.width / 2)) }])
        setBands([...bands, ''])
        setCommitError(null)
      }}>{tr('Добавить вершину')}</Button>
      <Button disabled={!result.contour} onClick={() => {
        if (!result.contour) return
        const commit = polygonCommitResult(board, result.contour)
        if (commit.error || !commit.patch) { setCommitError(commit.error ?? 'contour: жарамсыз контур'); return }
        try { onApply(commit.patch); setCommitError(null) }
        catch (cause) { setCommitError(cause instanceof Error ? cause.message : 'contour: жарамсыз контур') }
      }}>{tr('Применить контур')}</Button>
      {board.contour && <Button onClick={() => {
        onApply({ contour: undefined })
        setOpen(false)
      }}>{tr('Убрать контур')}</Button>}
      {!board.contour && <Button onClick={() => setOpen(false)}>{tr('Отмена')}</Button>}
    </div>
  </div>
}
