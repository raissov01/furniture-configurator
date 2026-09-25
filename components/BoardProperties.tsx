'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { t as tr } from '@/lib/i18n'
import { Button, Field, NumberInput, Select, Toggle } from '@/components/ui'
import { ExportMenu } from '@/components/ExportMenu'
import { boardDimensions, resizeBoard } from '@/src/core/boardProperties'
import { parseExactMm } from '@/src/core/exactMm'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, ORIENT_UPRIGHT } from '@/src/core/index'
import type { BoardNode, BoardSpec, Catalog, Orientation, Panel, PanelEdges } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

type Tab = 'general' | 'material' | 'reports' | 'production'
const orientations: { value: string; label: string; orientation: Orientation }[] = [
  { value: 'front', label: 'Фасадная плоскость (D = толщина)', orientation: ORIENT_FACING },
  { value: 'side', label: 'Боковая плоскость (W = толщина)', orientation: ORIENT_SIDE },
  { value: 'horizontal', label: 'Горизонтальная плоскость (H = толщина)', orientation: ORIENT_HORIZONTAL },
  { value: 'upright', label: 'Вертикальная плоскость (D = толщина)', orientation: ORIENT_UPRIGHT },
]
const edges: (keyof PanelEdges)[] = ['L1', 'L2', 'W1', 'W2']

function RelativeMmInput({ current, label, onChange, onError }: {
  current: number; label: string; onChange: (value: number) => void; onError: (message: string) => void
}) {
  const [draft, setDraft] = useState('')
  return <input type="text" inputMode="numeric" value={draft} placeholder={tr('+/- мм')}
    title={tr('Абсолютно: 600 или =-100; относительно: +20 или -10')}
    aria-label={`${label}: ${tr('Точный ввод')}`} className="mt-1 w-full border border-neutral-300 bg-white px-1 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
    onChange={(event) => setDraft(event.target.value)} onBlur={() => setDraft('')}
    onKeyDown={(event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      try { onChange(parseExactMm(draft, current)); setDraft(''); onError('') }
      catch (cause) { onError(cause instanceof Error ? cause.message : tr('Неверное значение')) }
    }} />
}

export function BoardProperties({ node, panel, catalog }: { node: BoardNode; panel: Panel | undefined; catalog: Catalog }) {
  const [tab, setTab] = useState<Tab>('general')
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(node.name)
  useEffect(() => setName(node.name), [node.id, node.name])
  const editBoard = useConfigurator((s) => s.editBoard)
  const setBoardPosition = useConfigurator((s) => s.setBoardPosition)
  const renameNode = useConfigurator((s) => s.renameNode)
  const setDrillOpen = useConfigurator((s) => s.setDrillOpen)
  const setQuoteOpen = useConfigurator((s) => s.setQuoteOpen)
  const material = catalog.materials.find((item) => item.id === node.board.materialId)
  if (!material) return <p role="alert">{tr('Материал не найден')}</p>
  const size = boardDimensions(node.board, material)
  const orientation = orientations.find((item) =>
    JSON.stringify(item.orientation) === JSON.stringify(node.board.orientation))?.value ?? 'front'
  const run = (fn: () => void) => {
    try { fn(); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось изменить деталь')) }
  }
  const edit = (patch: Partial<BoardSpec>) => run(() => editBoard(node.id, patch))
  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: tr('Общее') }, { id: 'material', label: tr('Материал') },
    { id: 'reports', label: tr('Отчёты') }, { id: 'production', label: tr('Производство') },
  ]
  return <section data-testid="board-properties" className="space-y-3 text-xs">
    <div role="tablist" aria-label={tr('Свойства детали')} className="flex flex-wrap gap-1 border-b border-neutral-300 pb-2 dark:border-neutral-700">
      {tabs.map((item) => <Button key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</Button>)}
    </div>
    {error && <p role="alert" className="border border-red-500 p-2 text-red-700">{error}</p>}
    <div className={tab === 'general' ? 'space-y-3' : 'hidden'}>
      <Field label={tr('Название')}><input data-properties-name className="w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        value={name} onChange={(event) => setName(event.target.value)} onBlur={() => {
          if (name !== node.name) run(() => renameNode(node.id, name))
        }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></Field>
      <Field label={tr('Ориентация')}><Select value={orientation} onChange={(value) => edit({ orientation: orientations.find((item) => item.value === value)!.orientation })}
        options={orientations.map(({ value, label }) => ({ value, label: tr(label) }))} /></Field>
      <div className="grid grid-cols-3 gap-2" data-testid="board-dimensions">
        {(['height', 'width', 'depth'] as const).map((dimension) => {
          const fixed = node.board.orientation.thickness === ({ height: 'y', width: 'x', depth: 'z' } as const)[dimension]
          return <Field key={dimension} label={`${dimension === 'height' ? 'H' : dimension === 'width' ? 'W' : 'D'}, мм`}
            hint={fixed ? tr('толщина материала') : undefined}>
            {fixed ? <input type="number" readOnly value={size[dimension]} className="w-full border border-neutral-300 bg-neutral-100 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800" />
              : <><NumberInput value={size[dimension]} min={1} onChange={(value) => run(() => editBoard(node.id, resizeBoard(node.board, material, dimension, value)))} />
                <RelativeMmInput current={size[dimension]} label={dimension.toUpperCase()} onError={setError}
                  onChange={(value) => editBoard(node.id, resizeBoard(node.board, material, dimension, value))} /></>}
          </Field>
        })}
      </div>
      <div className="grid grid-cols-3 gap-2" data-testid="board-position">
        {(['x', 'y', 'z'] as const).map((axis) => <Field key={axis} label={`${axis.toUpperCase()}, мм`}>
          <NumberInput value={node.transform.pos[axis]} onChange={(value) => run(() => setBoardPosition(node.id, { ...node.transform.pos, [axis]: value }))} />
          <RelativeMmInput current={node.transform.pos[axis]} label={axis.toUpperCase()} onError={setError}
            onChange={(value) => setBoardPosition(node.id, { ...node.transform.pos, [axis]: value })} />
        </Field>)}
      </div>
    </div>
    <div className={tab === 'material' ? 'space-y-3' : 'hidden'}>
      <Field label={tr('Материал')}><Select value={material.id} onChange={(materialId) => edit({ materialId })}
        options={catalog.materials.map((item) => ({ value: item.id, label: item.name }))} /></Field>
      <p>{tr('Толщина, мм')}: <strong>{material.thickness}</strong></p>
      <div className="grid grid-cols-2 gap-2">
        {edges.map((edge) => <Field key={edge} label={`${tr('Кромка')} ${edge}`}>
          <Select value={node.board.edges[edge]?.bandId ?? ''} onChange={(bandId) => edit({
            edges: { ...node.board.edges, [edge]: bandId ? { bandId } : null },
          })} options={[{ value: '', label: tr('Нет') }, ...catalog.edgeBands.map((band) => ({ value: band.id, label: band.name }))]} />
        </Field>)}
      </div>
      <Toggle checked={node.board.grainAlongLength} onChange={(grainAlongLength) => edit({ grainAlongLength })} label={tr('Текстура вдоль длины')} />
    </div>
    <div className={tab === 'reports' ? 'space-y-2' : 'hidden'}>
      <p>{tr('Готовый')}: {panel ? `${panel.finishedLength} × ${panel.finishedWidth} мм` : '—'}</p>
      <p data-testid="board-cut-size">{tr('Рез')}: {panel ? `${panel.cutLength} × ${panel.cutWidth} мм` : '—'}</p>
      <Button onClick={() => setQuoteOpen(true)}>{tr('Открыть смету')}</Button>
      <Link href="/cut" className="inline-block border border-neutral-300 px-2 py-1 dark:border-neutral-700">{tr('Открыть раскрой')}</Link>
    </div>
    <div className={tab === 'production' ? 'space-y-2' : 'hidden'}>
      <Button onClick={() => setDrillOpen(true)}>{tr('Открыть присадку')}</Button>
      <ExportMenu panels={panel ? [panel] : []} exportId={node.id} exportName={node.name} />
    </div>
  </section>
}
