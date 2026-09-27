'use client'

import { useEffect, useMemo, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { treeDockTabs, treeDockTabLabels, type TreeDockTab } from '@/lib/f11FindDock'
import type { DockRequest } from '@/lib/treeDockUi'
import type { SceneNode } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { StructurePanel } from './StructurePanel'
import { LayersPanel } from './LayersPanel'
import { LibraryPanel } from './LibraryPanel'
import { ReplacePanel } from './ReplacePanel'
import { FindPanel } from './FindPanel'
import type { LayersPanelNode } from './LayersPanel'

function layerNodes(root: SceneNode): LayersPanelNode[] {
  const result: LayersPanelNode[] = []
  const visit = (node: SceneNode): void => {
    if (node.id !== root.id) result.push({ id: node.id, name: node.name, layerId: node.layerId })
    if (node.kind === 'group') node.children.forEach(visit)
  }
  visit(root)
  return result
}

/** Existing Structure and Layers panels share one dock; Workspace mounts this once. */
export function TreeDock({ request }: { request?: DockRequest | undefined }) {
  const [tab, setTab] = useState<TreeDockTab>('structure')
  const [collapsed, setCollapsed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const createLayer = useConfigurator((s) => s.createLayer)
  const renameLayer = useConfigurator((s) => s.renameLayer)
  const setLayerVisible = useConfigurator((s) => s.setLayerVisible)
  const setLayerLocked = useConfigurator((s) => s.setLayerLocked)
  const setLayerColor = useConfigurator((s) => s.setLayerColor)
  const deleteLayer = useConfigurator((s) => s.deleteLayer)
  const assignNodeLayer = useConfigurator((s) => s.assignNodeLayer)
  const setSelected = useConfigurator((s) => s.setSelected)
  const nodes = useMemo(() => layerNodes(root), [root])
  // SSR and the first client render agree; after hydration phones start closed.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    setCollapsed(media.matches)
    const onChange = (event: MediaQueryListEvent) => setCollapsed(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    if (!request || request.revision === 0) return
    setTab(request.tab)
    setCollapsed(false)
  }, [request?.revision])
  const run = (fn: () => void) => {
    try { fn(); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось изменить слой')) }
  }

  return <section data-testid="tree-dock" className="p100-tree-dock flex max-h-[40dvh] min-h-0 flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950 lg:max-h-[70vh]">
    <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? tr('Развернуть') : tr('Свернуть')}
      onClick={() => setCollapsed((value) => !value)} className="border-b border-neutral-300 px-2 py-1 text-left text-xs font-semibold dark:border-neutral-700">
      {collapsed ? '+ ' : '− '}{tr('Структура проекта')}
    </button>
    <div className={cn(collapsed ? 'hidden' : 'block', 'min-h-0 overflow-auto')}>
    <div role="tablist" aria-label={tr('Дерево, слои и библиотека')} className="flex flex-wrap border-b border-neutral-300 dark:border-neutral-700">
      {treeDockTabs.map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value}
        onClick={() => setTab(value)} className={cn('border-b px-1.5 py-1.5 text-[10px]', tab === value ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-neutral-500')}
      >{tr(treeDockTabLabels[value])}</button>)}
    </div>
    {error && <p role="alert" className="m-2 border border-red-600 p-1 text-xs text-red-700">{error}</p>}
    <div className={cn(tab === 'structure' ? 'block' : 'hidden', 'min-h-0 overflow-auto p-2')}><StructurePanel /></div>
    <div className={cn(tab === 'layers' ? 'block' : 'hidden', 'min-h-0 overflow-auto p-2')}>
      <LayersPanel layers={layers} nodes={nodes}
        onCreateLayer={(name) => run(() => createLayer(name))}
        onRenameLayer={(id, name) => run(() => renameLayer(id, name))}
        onSetVisible={(id, visible) => run(() => { setLayerVisible(id, visible); setSelected(null) })}
        onSetLocked={(id, locked) => run(() => setLayerLocked(id, locked))}
        onSetColor={(id, color) => run(() => setLayerColor(id, color))}
        onDeleteLayer={(id) => run(() => { deleteLayer(id); setSelected(null) })}
        onAssignNode={(id, layerId) => run(() => { assignNodeLayer(id, layerId); setSelected(null) })} />
    </div>
    <div className={cn(tab === 'library' ? 'block' : 'hidden', 'min-h-0 overflow-auto')}>{tab === 'library' ? <LibraryPanel /> : null}</div>
    <div className={cn(tab === 'find' ? 'block' : 'hidden', 'min-h-0 overflow-auto p-2')}><FindPanel /></div>
    <div className={cn(tab === 'replace' ? 'block' : 'hidden', 'min-h-0 overflow-auto p-2')}><ReplacePanel /></div>
    </div>
  </section>
}
