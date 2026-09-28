'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DragEvent, KeyboardEvent, MouseEvent } from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { selectionPropertiesNotice } from '@/lib/propertiesDialogState'
import { contextActions } from '@/lib/contextActions'
import { menuPosition } from '@/lib/menuPosition'
import { ConfigValidationError, copyNodeProperties, findNode, flattenTree, projectPanelId } from '@/src/core/index'
import type { AutoJointKind, AutoJointRecord, Axis, FlatScene, GroupNode, PropertyClipboard, PropertyGroup, ScalePercent } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { buildCanonicalRows, canDropInto, externalSelectionNodeIds, numberedCabinetLabels, selectTreeRows } from './canonicalTreeRows'
import type { CanonicalTreeRow } from './canonicalTreeRows'

type Props = {
  root: GroupNode
  rows: CanonicalTreeRow[]
  activeId: string
  selected: string | null
  onSelectNode: (id: string) => void
  onSelectPart: (nodeId: string, selectId: string) => void
  onCopy?: (id: string) => void
  onDelete?: (id: string, kind: string) => void
  onOpenDoor?: (id: string) => void
  canOpenDoor?: (id: string) => boolean
  onRename: (id: string, name: string) => void
  onHidden: (id: string, hidden: boolean) => void
  onLocked: (id: string, locked: boolean) => void
  onGroup: (ids: string[], groupId: string, name: string) => void
  onUngroup: (id: string) => void
  onReparent: (id: string, parentId: string) => void
  onArray: (id: string, opts: { axis: Axis; count: number; step: number }) => void
  onArrange: (ids: string[], axis: Axis, mode: 'min' | 'center' | 'max' | 'distribute') => void
  onAutoJoint: (ids: [string, string], kind: AutoJointKind, tolerance: number) => void
  onRemoveJoint?: (id: string) => void
  autoJoints?: readonly AutoJointRecord[]
}

/** One canonical project tree. The persisted node tree, not a second UI tree, drives its rows. */
export function StructureTreeView({ root, rows, activeId, selected, onSelectNode, onSelectPart,
  onCopy, onDelete, onOpenDoor, canOpenDoor, onRename, onHidden, onLocked, onGroup, onUngroup, onReparent, onArray, onArrange, onAutoJoint, onRemoveJoint,
  autoJoints = [] }: Props) {
  const [tab, setTab] = useState<'project' | 'selection'>('project')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [anchor, setAnchor] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<{ row: CanonicalTreeRow; x: number; y: number; selection: string[] } | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!context) return
    const dismiss = (event: PointerEvent) => { if (!contextRef.current?.contains(event.target as Node)) setContext(null) }
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation(); setContext(null)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key) }
  }, [context])
  const [arrayOpen, setArrayOpen] = useState(false)
  const [arrayAxis, setArrayAxis] = useState<Axis>('x')
  const [arrayCount, setArrayCount] = useState(2)
  const [arrayStep, setArrayStep] = useState(100)
  const [arrangeAxis, setArrangeAxis] = useState<Axis>('x')
  const [jointKind, setJointKind] = useState<AutoJointKind | ''>('')
  const [jointTolerance, setJointTolerance] = useState(0)
  const [propertyGroups, setPropertyGroups] = useState<Record<PropertyGroup, boolean>>({ material: true, edges: false, dimensions: false })
  const [propertyClipboard, setPropertyClipboard] = useState<PropertyClipboard | null>(null)
  const [copyStatus, setCopyStatus] = useState(false)
  const [scaleAxis, setScaleAxis] = useState<Axis | 'all'>('all')
  const [scalePercent, setScalePercent] = useState(100)
  const snapOptions = useConfigurator((s) => s.snapOptions)
  const setSnapOptions = useConfigurator((s) => s.setSnapOptions)
  const pasteProperties = useConfigurator((s) => s.pasteProperties)
  const scaleNode = useConfigurator((s) => s.scaleNode)
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const cabinetLabels = useMemo(() => numberedCabinetLabels(rows), [rows])
  const selectable = useMemo(() => rows.filter((row) => row.kind !== 'part' && row.id !== root.id && !row.locked).map((row) => row.id), [rows, root.id])
  const lastExternal = useRef<string | null>(null)

  // Әр жаңа жұпқа бекіткішті қайта ашық таңдайды; алдыңғы жұптың таңдауы өтпейді.
  useEffect(() => { setJointKind('') }, [selectedNodes.join('|')])

  useEffect(() => {
    const next = externalSelectionNodeIds(lastExternal.current, selected, rows, activeId)
    lastExternal.current = selected
    if (next !== undefined) { setSelectedNodes(next); setFocusId(next[0] ?? null) }
  }, [selected, rows, activeId])

  const run = (fn: () => void): boolean => {
    try { fn(); setError(null); return true }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось изменить структуру')); return false }
  }
  const choose = (row: CanonicalTreeRow, event?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
    if (row.locked) return
    setFocusId(row.id)
    if (row.kind === 'part' && row.selectId) {
      onSelectPart(row.nodeId, row.selectId)
      setSelectedNodes([row.nodeId]); setAnchor(row.nodeId)
    } else if (row.id !== root.id) {
      setSelectedNodes((current) => selectTreeRows(current, row.id, selectable, {
        ctrl: Boolean(event?.ctrlKey || event?.metaKey), shift: Boolean(event?.shiftKey), anchor,
      }))
      if (!event?.shiftKey) setAnchor(row.id)
      // Modifier selection is local until the edit; changing store.selected here
      // would make the 3D-sync effect collapse the multi-selection to one row.
      if (!event?.ctrlKey && !event?.metaKey && !event?.shiftKey) onSelectNode(row.id)
    }
  }
  const startRename = (row: CanonicalTreeRow) => {
    if (row.kind === 'part' || row.id === root.id || row.locked) return
    setEditing(row.id); setDraft(row.label)
  }
  const finishRename = (row: CanonicalTreeRow) => {
    const name = draft.trim(); setEditing(null)
    if (name && name !== row.label) run(() => onRename(row.id, name))
  }
  const group = () => {
    if (selectedNodes.length < 2) return
    const id = `group-${crypto.randomUUID()}`
    if (run(() => onGroup(selectedNodes, id, tr('Группа')))) setSelectedNodes([id])
  }
  const ungroup = () => {
    const id = selectedNodes.length === 1 ? selectedNodes[0] : null
    const row = id ? byId.get(id) : undefined
    if (id && row?.kind === 'group' && !row.locked && id !== root.id && run(() => onUngroup(id))) setSelectedNodes([])
  }
  const arrange = (mode: 'min' | 'center' | 'max' | 'distribute') => {
    if (selectedNodes.length < (mode === 'distribute' ? 3 : 2)) return
    run(() => onArrange(selectedNodes, arrangeAxis, mode))
  }
  const makeArray = () => {
    const id = selectedNodes.length === 1 ? selectedNodes[0] : null
    if (id && run(() => onArray(id, { axis: arrayAxis, count: arrayCount, step: arrayStep }))) setArrayOpen(false)
  }
  const selectedToolNode = selectedNodes.length === 1 ? findNode(root, selectedNodes[0]!) : undefined
  const canCopyProperties = selectedToolNode?.kind === 'board' || selectedToolNode?.kind === 'cabinet'
  const copyProperties = () => {
    if (!canCopyProperties || !selectedToolNode) return
    const groups = (['material', 'edges', 'dimensions'] as const)
      .filter((group) => propertyGroups[group] && (group !== 'edges' || selectedToolNode.kind === 'board'))
    run(() => {
      setPropertyClipboard(copyNodeProperties(root, selectedToolNode.id, groups))
      setCopyStatus(true)
    })
  }
  const pasteCopiedProperties = () => {
    if (propertyClipboard && selectedNodes.length > 0) run(() => pasteProperties(propertyClipboard, selectedNodes))
  }
  const scaleSelected = () => {
    if (selectedNodes.length !== 1) return
    const factors: ScalePercent = { x: 100, y: 100, z: 100 }
    if (scaleAxis === 'all') factors.x = factors.y = factors.z = scalePercent
    else factors[scaleAxis] = scalePercent
    run(() => scaleNode(selectedNodes[0]!, factors))
  }
  const selectedBoards = selectedNodes.length === 2
    && selectedNodes.every((id) => byId.get(id)?.kind === 'board')
    ? selectedNodes as [string, string] : null
  const selectedJoint = selectedBoards
    ? autoJoints.find((joint) => selectedBoards.every((id) => joint.boardIds.includes(id)))
    : undefined
  const selectedJointKind = jointKind || selectedJoint?.kind || ''
  const selectionNotice = selectionPropertiesNotice(selectedNodes.length)
  const collapsedAncestor = (row: CanonicalTreeRow): boolean => {
    let parent = row.parentId
    while (parent) { if (collapsed[parent]) return true; parent = byId.get(parent)?.parentId ?? null }
    return false
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && event.altKey && ['1', '2', '3', '4'].includes(key)) {
      event.preventDefault(); arrange(({ '1': 'min', '2': 'center', '3': 'max', '4': 'distribute' } as const)[key as '1' | '2' | '3' | '4'])
    } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'c') {
      event.preventDefault(); copyProperties()
    } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'v') {
      event.preventDefault(); pasteCopiedProperties()
    } else if ((event.ctrlKey || event.metaKey) && key === 'g') {
      event.preventDefault(); if (event.shiftKey) ungroup(); else group()
    } else if (key === 'f2') {
      const row = focusId ? byId.get(focusId) : undefined
      if (row) { event.preventDefault(); startRename(row) }
    } else if (key === 'escape') {
      setSelectedNodes([]); setEditing(null)
    } else if (key === 'arrowup' || key === 'arrowdown') {
      event.preventDefault()
      const visible = rows.filter((row) => !row.locked && !collapsedAncestor(row))
      const index = visible.findIndex((row) => row.id === focusId)
      const target = visible[Math.max(0, Math.min(visible.length - 1, index + (key === 'arrowdown' ? 1 : -1)))]
      if (target) {
        choose(target)
        const button = document.querySelectorAll<HTMLElement>('[data-tree-node]')
        for (const candidate of button) if (candidate.dataset.treeNode === target.id) { candidate.focus(); break }
      }
    }
  }
  const drop = (event: DragEvent<HTMLDivElement>, row: CanonicalTreeRow) => {
    event.preventDefault()
    const source = event.dataTransfer.getData('text/plain')
    if (!row.locked && canDropInto(root, source, row.id)) run(() => onReparent(source, row.id))
  }
  const click = (event: MouseEvent<HTMLButtonElement>, row: CanonicalTreeRow) => choose(row, event)

  return <div data-panel="structure" className="flex min-h-0 flex-col gap-2 text-xs text-neutral-800 dark:text-neutral-200">
    <div role="tablist" aria-label={tr('Структура проекта')} className="flex border-b border-neutral-300 dark:border-neutral-700">
      {(['project', 'selection'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value}
        className={cn('border-b-2 px-2 py-1', tab === value ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-neutral-500')}
        onClick={() => setTab(value)}>{value === 'project' ? tr('Проект') : tr('Выделение')}</button>)}
    </div>
    {autoJoints.filter((joint) => joint.status === 'broken').map((joint) =>
      <div key={joint.id} role="alert" data-testid="broken-auto-joint"
        className="border border-amber-600 p-1 text-amber-900 dark:text-amber-200">
        {tr('Автоматическая присадка нарушена')}: <b className="font-mono">{joint.error?.field ?? 'joint.boardIds'}</b> —
        {' '}{tr('Проверьте контакт досок и крепёж')} ({joint.boardIds.join(', ')})
      </div>)}
    <div className="flex items-center gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700">
      <button type="button" disabled={selectedNodes.length < 2} onClick={group} title={tr('Группировать (Ctrl+G)')}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Группа')}</button>
      <button type="button" disabled={selectedNodes.length !== 1 || byId.get(selectedNodes[0] ?? '')?.kind !== 'group'} onClick={ungroup}
        title={tr('Разгруппировать (Ctrl+Shift+G)')} className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Разгруппировать')}</button>
      <span className="ml-auto text-neutral-500">{selectedNodes.length}</span>
    </div>
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700" data-testid="arrange-tools">
      <select aria-label={tr('Ось выравнивания')} value={arrangeAxis} onChange={(event) => setArrangeAxis(event.target.value as Axis)}
        className="border border-neutral-300 bg-white px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900">
        {(['x', 'y', 'z'] as const).map((axis) => <option key={axis} value={axis}>{axis.toUpperCase()}</option>)}
      </select>
      {(['min', 'center', 'max', 'distribute'] as const).map((mode, index) => <button key={mode} type="button"
        disabled={selectedNodes.length < (mode === 'distribute' ? 3 : 2)} onClick={() => arrange(mode)}
        title={`${tr(({ min: 'По началу', center: 'По центру', max: 'По концу', distribute: 'Распределить' })[mode])} (Ctrl+Alt+${index + 1})`}
        data-testid={`arrange-${mode}`}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">
        {tr(({ min: 'Начало', center: 'Центр', max: 'Конец', distribute: 'Равномерно' })[mode])}
      </button>)}
      <button type="button" disabled={selectedNodes.length !== 1} onClick={() => setArrayOpen((open) => !open)}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Массив')}</button>
    </div>
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700" data-testid="property-tools">
      <span className="font-medium">{tr('Группы свойств')}:</span>
      {(['material', 'edges', 'dimensions'] as const).map((propertyGroup) => <label key={propertyGroup} className="flex items-center gap-1">
        <input type="checkbox" checked={propertyGroups[propertyGroup]}
          disabled={propertyGroup === 'edges' && selectedToolNode?.kind === 'cabinet'}
          onChange={(event) => setPropertyGroups((current) => ({ ...current, [propertyGroup]: event.target.checked }))} />
        {tr(({ material: 'Материал', edges: 'Кромка', dimensions: 'Размеры' })[propertyGroup])}
      </label>)}
      <button type="button" data-testid="copy-properties" disabled={!canCopyProperties} onClick={copyProperties}
        title={tr('Копировать свойства (Ctrl+Shift+C)')}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">
        {tr('Копировать свойства')}
      </button>
      <button type="button" data-testid="paste-properties" disabled={!propertyClipboard || selectedNodes.length === 0} onClick={pasteCopiedProperties}
        title={tr('Вставить свойства (Ctrl+Shift+V)')}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">
        {tr('Вставить свойства')}
      </button>
      {copyStatus && <span role="status">{tr('Свойства скопированы')}</span>}
    </div>
    <div className="flex flex-wrap items-end gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700" data-testid="scale-tools">
      <label>{tr('Ось масштабирования')}
        <select aria-label={tr('Ось масштабирования')} value={scaleAxis} onChange={(event) => setScaleAxis(event.target.value as Axis | 'all')}
          className="block border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="all">{tr('Пропорционально')}</option>
          {(['x', 'y', 'z'] as const).map((axis) => <option key={axis} value={axis}>{axis.toUpperCase()}</option>)}
        </select>
      </label>
      <label>{tr('Масштаб, %')}<input type="number" min={1} step={1} value={scalePercent}
        onChange={(event) => setScalePercent(Number(event.target.value))}
        className="block w-20 border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900" /></label>
      <button type="button" data-testid="scale-node" disabled={selectedNodes.length !== 1} onClick={scaleSelected}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Масштабировать')}</button>
    </div>
    {arrayOpen && <div className="flex flex-wrap items-end gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700" data-testid="array-tools">
      <label>{tr('Ось')}<select value={arrayAxis} onChange={(event) => setArrayAxis(event.target.value as Axis)}
        className="block border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900">
        {(['x', 'y', 'z'] as const).map((axis) => <option key={axis} value={axis}>{axis.toUpperCase()}</option>)}
      </select></label>
      <label>{tr('Копий')}<input type="number" min={1} max={1000} value={arrayCount} onChange={(event) => setArrayCount(Number(event.target.value))}
        className="block w-16 border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900" /></label>
      <label>{tr('Шаг, мм')}<input type="number" step={1} value={arrayStep} onChange={(event) => setArrayStep(Number(event.target.value))}
        className="block w-20 border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900" /></label>
      <button type="button" onClick={makeArray} disabled={selectedNodes.length !== 1}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Создать')}</button>
    </div>}
    <div className="flex gap-2 border-b border-neutral-300 pb-1 dark:border-neutral-700" data-testid="snap-tools">
      <label>{tr('Сетка, мм')}<input type="number" min={0} step={1} value={snapOptions.grid}
        onChange={(event) => run(() => setSnapOptions({ ...snapOptions, grid: Number(event.target.value) }))}
        className="ml-1 w-14 border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900" /></label>
      <label>{tr('Порог, мм')}<input type="number" min={0} step={1} value={snapOptions.tolerance}
        onChange={(event) => run(() => setSnapOptions({ ...snapOptions, tolerance: Number(event.target.value) }))}
        className="ml-1 w-14 border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900" /></label>
    </div>
    {selectedBoards && <div className="flex flex-wrap items-end gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700" data-testid="auto-joint-tools">
      <label>{tr('Крепёж для присадки')}
        <select value={selectedJointKind} onChange={(event) => setJointKind(event.target.value as AutoJointKind | '')}
          className="block border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Выберите крепёж')}</option>
          <option value="confirmat">{tr('Конфирмат')}</option>
          <option value="minifix">{tr('Минификс')}</option>
        </select>
      </label>
      <span className="text-neutral-500" title={tr('Для шканта нужны настройки артикула в цехе')}>{tr('Шкант — вручную')}</span>
      <label>{tr('Допуск касания, мм')}
        <input type="number" min={0} step={1} value={selectedJoint?.tolerance ?? jointTolerance}
          disabled={Boolean(selectedJoint)}
          onChange={(event) => setJointTolerance(Number(event.target.value))}
          className="block w-20 border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900" />
      </label>
      <button type="button" disabled={!selectedJointKind} data-testid="auto-joint-apply"
        onClick={() => { if (selectedJointKind && run(() => onAutoJoint(selectedBoards, selectedJointKind, selectedJoint?.tolerance ?? jointTolerance))) setJointKind('') }}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">
        {tr('Автоматическая присадка')}
      </button>
      {selectedJoint && onRemoveJoint ? <button type="button" data-testid="auto-joint-remove"
        onClick={() => run(() => onRemoveJoint(selectedJoint.id))}
        className="border border-neutral-300 px-1 py-0.5 dark:border-neutral-700">
        {tr('Удалить соединение')}
      </button> : null}
    </div>}
    {error && <p role="alert" className="border border-red-600 p-1 text-red-700">{error}</p>}
    {selectionNotice && <p role="status" data-testid="multi-properties-notice"
      className="border border-neutral-400 p-1 text-xs dark:border-neutral-600">{tr(selectionNotice)}</p>}
    <div role="tree" aria-label={tr('Структура проекта')} onKeyDown={onKeyDown} className="min-h-0 overflow-auto">
      {rows.map((row) => {
        const closed = collapsed[row.id] === true
        const shown = tab === 'project' ? !collapsedAncestor(row) : row.kind === 'part' ? row.selectId === selected
          : selectedNodes.includes(row.id) || (selectedNodes.length === 0 && row.id === activeId)
        const chosen = row.kind === 'part' ? row.selectId === selected : selectedNodes.includes(row.id) || (row.id === activeId && selectedNodes.length === 0)
        return <div key={row.id} role="treeitem" aria-level={row.depth + 1} aria-selected={chosen}
          onContextMenu={(event) => {
            event.preventDefault()
            if (row.id === root.id) return
            const selection = selectedNodes.includes(row.id) ? selectedNodes : [row.kind === 'part' ? row.nodeId : row.id]
            if (!selectedNodes.includes(row.id)) {
              setSelectedNodes(selection)
              if (row.kind === 'part' && row.selectId) onSelectPart(row.nodeId, row.selectId)
              else onSelectNode(row.id)
            }
            setContext({ row, x: event.clientX, y: event.clientY, selection })
          }}
          aria-expanded={row.hasChildren ? !closed : undefined}
          className={cn(shown ? 'flex' : 'hidden', 'items-center gap-1 border-l-2 py-0.5 pr-1', chosen ? 'border-blue-600 bg-blue-50 dark:bg-neutral-800' : 'border-transparent')}
          style={{ paddingLeft: row.depth * 12 + 2 }}
          onDragOver={(event) => { if (row.kind === 'group' && !row.locked) event.preventDefault() }}
          onDrop={(event) => drop(event, row)}>
          {row.hasChildren ? <button type="button" aria-label={closed ? tr('Развернуть') : tr('Свернуть')}
            className="w-4 shrink-0 text-neutral-500" onClick={() => setCollapsed((current) => ({ ...current, [row.id]: !closed }))}>{closed ? '+' : '−'}</button>
            : <span className="w-4 shrink-0" />}
          <span aria-hidden="true" className="h-2 w-2 shrink-0 border border-neutral-500" style={{ backgroundColor: row.layerColor ?? undefined }} />
          {editing === row.id ? <input autoFocus aria-label={tr('Название')} value={draft} onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') finishRename(row); if (event.key === 'Escape') setEditing(null) }}
            onBlur={() => finishRename(row)} className="min-w-0 flex-1 border border-neutral-400 bg-white px-1 dark:bg-neutral-900" /> :
            <button type="button" data-tree-node={row.id} data-module={row.kind === 'cabinet' ? row.id : undefined}
              disabled={row.locked} title={row.label}
              draggable={row.kind !== 'part' && row.id !== root.id && !row.locked}
              onDragStart={(event) => event.dataTransfer.setData('text/plain', row.id)}
              onClick={(event) => click(event, row)} onDoubleClick={() => startRename(row)}
              className={cn('min-w-0 flex-1 truncate text-left', row.hidden && 'text-neutral-400 line-through', row.locked && 'opacity-60')}>{cabinetLabels.get(row.id) ?? row.label}</button>}
          {row.kind === 'part' && row.roleLabel && <span className="text-[10px] text-neutral-500">{tr(row.roleLabel)}</span>}
          {row.kind !== 'part' && row.id !== root.id && <>
            <button type="button" aria-label={row.ownHidden ? tr('Показать') : tr('Скрыть')}
              disabled={row.locked} onClick={() => run(() => onHidden(row.id, !row.ownHidden))}
              className="border border-neutral-300 px-1 disabled:opacity-40 dark:border-neutral-700">{row.ownHidden ? '○' : '◉'}</button>
            <button type="button" aria-label={row.ownLocked ? tr('Разблокировать') : tr('Заблокировать')}
              disabled={row.locked && !row.ownLocked} onClick={() => run(() => onLocked(row.id, !row.ownLocked))}
              className="border border-neutral-300 px-1 disabled:opacity-40 dark:border-neutral-700">{row.ownLocked ? '●' : '○'}</button>
          </>}
        </div>
      })}
    </div>
    {context && typeof document !== 'undefined' ? createPortal((() => {
      const allowed = contextActions(context.row.kind, context.selection.length,
        rows.filter((row) => row.kind === 'cabinet').length, context.row.locked)
      const position = menuPosition({ left: context.x, right: context.x, top: context.y, bottom: context.y },
        window.innerWidth, window.innerHeight, 210, 'left')
      const item = (label: string, enabled: boolean, action: () => void) => <button type="button" role="menuitem"
        key={label} disabled={!enabled} className="block min-h-9 w-full border border-transparent px-3 text-left text-sm text-neutral-900 hover:bg-neutral-100 disabled:opacity-40"
        onClick={() => { setContext(null); action() }}>{tr(label)}</button>
      return <div ref={contextRef} role="menu" aria-label={tr('Структура')}
        className="fixed z-[1000] w-[210px] overflow-y-auto border border-neutral-400 bg-white p-1"
        style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}>
        {item('Свойства', allowed.properties, () => window.dispatchEvent(new CustomEvent('furniture:open-properties', { detail: context.row.nodeId })))}
        {item('Копировать', allowed.copy && Boolean(onCopy), () => onCopy?.(context.row.id))}
        {item('Удалить', allowed.delete && Boolean(onDelete), () => run(() => onDelete?.(context.row.id, context.row.kind)))}
        {item('Группа', allowed.group, group)}
        {item('Разгруппировать', allowed.ungroup, ungroup)}
        {item('Открыть дверцу', allowed.door && Boolean(context.row.selectId && canOpenDoor?.(context.row.selectId)),
          () => { if (context.row.selectId) onOpenDoor?.(context.row.selectId) })}
      </div>
    })(), document.body) : null}
  </div>
}

/** Store wrapper; Workspace mounts it through TreeDock. */
export function StructurePanel() {
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const catalog = useConfigurator((s) => s.catalog)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const autoJoints = useConfigurator((s) => s.autoJoints)
  const activeId = useConfigurator((s) => s.activeId)
  const selected = useConfigurator((s) => s.selected)
  const setActive = useConfigurator((s) => s.setActive)
  const setSelected = useConfigurator((s) => s.setSelected)
  const duplicateCabinet = useConfigurator((s) => s.duplicateCabinet)
  const removeCabinet = useConfigurator((s) => s.removeCabinet)
  const removeBoard = useConfigurator((s) => s.removeBoard)
  const removeAnnotation = useConfigurator((s) => s.removeAnnotation)
  const togglePanelOpen = useConfigurator((s) => s.togglePanelOpen)
  const renameNode = useConfigurator((s) => s.renameNode)
  const setNodeHidden = useConfigurator((s) => s.setNodeHidden)
  const setNodeLocked = useConfigurator((s) => s.setNodeLocked)
  const groupSelected = useConfigurator((s) => s.groupSelected)
  const arrayNode = useConfigurator((s) => s.arrayNode)
  const arrangeNodes = useConfigurator((s) => s.arrangeNodes)
  const autoJointBoards = useConfigurator((s) => s.autoJointBoards)
  const removeAutoJoint = useConfigurator((s) => s.removeAutoJoint)
  const ungroup = useConfigurator((s) => s.ungroup)
  const reparent = useConfigurator((s) => s.reparent)
  const { scene, error } = useMemo((): { scene: FlatScene; error: string | null } => {
    try { return { scene: flattenTree(root, catalog, settings, layers, autoJoints), error: null } }
    catch (cause) {
      if (!(cause instanceof ConfigValidationError)) throw cause
      return { scene: { nodes: [], solids: [] }, error: cause.message }
    }
  }, [root, catalog, settings, layers, autoJoints])
  const rows = useMemo(() => buildCanonicalRows(root, scene, layers), [root, scene, layers])
  return <>
    {error && <p role="alert" className="mb-1 border border-red-600 p-1 text-xs text-red-700">{error}</p>}
    <StructureTreeView root={root} rows={rows} activeId={activeId} selected={selected} autoJoints={autoJoints}
      onSelectNode={(id) => { setActive(id); setSelected(rows.find((row) => row.id === id)?.selectId ?? null) }}
      onSelectPart={(nodeId, selectId) => { setActive(nodeId); setSelected(selectId) }}
      onCopy={duplicateCabinet}
      onDelete={(id, kind) => {
        if (kind === 'cabinet') removeCabinet(id)
        else if (kind === 'board') removeBoard(id)
        else if (kind === 'annotation') removeAnnotation(id)
        setSelected(null)
      }}
      onOpenDoor={togglePanelOpen}
      canOpenDoor={(id) => scene.nodes.some((node) => node.panels.some((panel) =>
        projectPanelId(node.nodeId, panel.id, scene.nodes.length) === id && Boolean(panel.opening)))}
      onRename={renameNode}
      onHidden={(id, hidden) => { setNodeHidden(id, hidden); setSelected(null) }}
      onLocked={setNodeLocked}
      onGroup={groupSelected}
      onArray={arrayNode}
      onArrange={arrangeNodes}
      onAutoJoint={autoJointBoards}
      onRemoveJoint={removeAutoJoint}
      onUngroup={(id) => { ungroup(id); setSelected(null) }}
      onReparent={(id, parentId) => { reparent(id, parentId); setSelected(null) }} />
  </>
}
