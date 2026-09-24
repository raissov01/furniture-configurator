'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, MouseEvent } from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { ConfigValidationError, flattenTree } from '@/src/core/index'
import type { FlatScene, GroupNode } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { buildCanonicalRows, canDropInto, externalSelectionNodeIds, selectTreeRows } from './canonicalTreeRows'
import type { CanonicalTreeRow } from './canonicalTreeRows'

type Props = {
  root: GroupNode
  rows: CanonicalTreeRow[]
  activeId: string
  selected: string | null
  onSelectNode: (id: string) => void
  onSelectPart: (nodeId: string, selectId: string) => void
  onRename: (id: string, name: string) => void
  onHidden: (id: string, hidden: boolean) => void
  onLocked: (id: string, locked: boolean) => void
  onGroup: (ids: string[], groupId: string, name: string) => void
  onUngroup: (id: string) => void
  onReparent: (id: string, parentId: string) => void
}

/** One canonical project tree. The persisted node tree, not a second UI tree, drives its rows. */
export function StructureTreeView({ root, rows, activeId, selected, onSelectNode, onSelectPart,
  onRename, onHidden, onLocked, onGroup, onUngroup, onReparent }: Props) {
  const [tab, setTab] = useState<'project' | 'selection'>('project')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [anchor, setAnchor] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const selectable = useMemo(() => rows.filter((row) => row.kind !== 'part' && row.id !== root.id && !row.locked).map((row) => row.id), [rows, root.id])
  const lastExternal = useRef<string | null>(null)

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
  const collapsedAncestor = (row: CanonicalTreeRow): boolean => {
    let parent = row.parentId
    while (parent) { if (collapsed[parent]) return true; parent = byId.get(parent)?.parentId ?? null }
    return false
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && key === 'g') {
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
    <div className="flex items-center gap-1 border-b border-neutral-300 pb-1 dark:border-neutral-700">
      <button type="button" disabled={selectedNodes.length < 2} onClick={group} title={tr('Группировать (Ctrl+G)')}
        className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Группа')}</button>
      <button type="button" disabled={selectedNodes.length !== 1 || byId.get(selectedNodes[0] ?? '')?.kind !== 'group'} onClick={ungroup}
        title={tr('Разгруппировать (Ctrl+Shift+G)')} className="border border-neutral-300 px-1 py-0.5 disabled:opacity-40 dark:border-neutral-700">{tr('Разгруппировать')}</button>
      <span className="ml-auto text-neutral-500">{selectedNodes.length}</span>
    </div>
    {error && <p role="alert" className="border border-red-600 p-1 text-red-700">{error}</p>}
    <div role="tree" aria-label={tr('Структура проекта')} onKeyDown={onKeyDown} className="min-h-0 overflow-auto">
      {rows.map((row) => {
        const closed = collapsed[row.id] === true
        const shown = tab === 'project' ? !collapsedAncestor(row) : row.kind === 'part' ? row.selectId === selected
          : selectedNodes.includes(row.id) || (selectedNodes.length === 0 && row.id === activeId)
        const chosen = row.kind === 'part' ? row.selectId === selected : selectedNodes.includes(row.id) || (row.id === activeId && selectedNodes.length === 0)
        return <div key={row.id} role="treeitem" aria-level={row.depth + 1} aria-selected={chosen}
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
              className={cn('min-w-0 flex-1 truncate text-left', row.hidden && 'text-neutral-400 line-through', row.locked && 'opacity-60')}>{row.label}</button>}
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
  </div>
}

/** Store wrapper; Workspace mounts it through TreeDock. */
export function StructurePanel() {
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const catalog = useConfigurator((s) => s.catalog)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const activeId = useConfigurator((s) => s.activeId)
  const selected = useConfigurator((s) => s.selected)
  const setActive = useConfigurator((s) => s.setActive)
  const setSelected = useConfigurator((s) => s.setSelected)
  const renameNode = useConfigurator((s) => s.renameNode)
  const setNodeHidden = useConfigurator((s) => s.setNodeHidden)
  const setNodeLocked = useConfigurator((s) => s.setNodeLocked)
  const groupSelected = useConfigurator((s) => s.groupSelected)
  const ungroup = useConfigurator((s) => s.ungroup)
  const reparent = useConfigurator((s) => s.reparent)
  const { scene, error } = useMemo((): { scene: FlatScene; error: string | null } => {
    try { return { scene: flattenTree(root, catalog, settings, layers), error: null } }
    catch (cause) {
      if (!(cause instanceof ConfigValidationError)) throw cause
      return { scene: { nodes: [], solids: [] }, error: cause.message }
    }
  }, [root, catalog, settings, layers])
  const rows = useMemo(() => buildCanonicalRows(root, scene, layers), [root, scene, layers])
  return <>
    {error && <p role="alert" className="mb-1 border border-red-600 p-1 text-xs text-red-700">{error}</p>}
    <StructureTreeView root={root} rows={rows} activeId={activeId} selected={selected}
      onSelectNode={(id) => { setActive(id); setSelected(rows.find((row) => row.id === id)?.selectId ?? null) }}
      onSelectPart={(nodeId, selectId) => { setActive(nodeId); setSelected(selectId) }}
      onRename={renameNode}
      onHidden={(id, hidden) => { setNodeHidden(id, hidden); setSelected(null) }}
      onLocked={setNodeLocked}
      onGroup={groupSelected}
      onUngroup={(id) => { ungroup(id); setSelected(null) }}
      onReparent={(id, parentId) => { reparent(id, parentId); setSelected(null) }} />
  </>
}
