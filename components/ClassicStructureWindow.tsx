'use client'

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { TreeDock } from '@/components/panels/TreeDock'
import { treeDockTabLabels, type TreeDockTab } from '@/lib/f11FindDock'
import type { DockRequest } from '@/lib/treeDockUi'

/** Small movable desktop window. Pointer capture keeps the drag inside the title bar. */
export function ClassicStructureWindow({ onClose, onProperties, canOpenProperties, dockRequest }: {
  onClose: () => void; onProperties: () => void; canOpenProperties: boolean; dockRequest?: DockRequest
}) {
  const [position, setPosition] = useState({ x: 200, y: 160 })
  const [tab, setTab] = useState<TreeDockTab>('structure')
  const [start, setStart] = useState<{ x: number; y: number; left: number; top: number } | null>(null)
  return <div data-testid="classic-structure-window" className="p100-floating-window" style={{ left: position.x, top: position.y }}>
    <div className="p100-floating-title" onPointerDown={(event) => {
      if ((event.target as HTMLElement).closest('button')) return
      event.currentTarget.setPointerCapture(event.pointerId)
      setStart({ x: event.clientX, y: event.clientY, left: position.x, top: position.y })
    }} onPointerMove={(event) => {
      if (!start) return
      setPosition({
        x: Math.max(28, Math.min(window.innerWidth - 120, start.left + event.clientX - start.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, start.top + event.clientY - start.y)),
      })
    }} onPointerUp={() => setStart(null)} onLostPointerCapture={() => setStart(null)}>
      <span>{tr(treeDockTabLabels[tab])}</span>
      <button type="button" disabled={!canOpenProperties} onClick={onProperties}>{tr('Свойства')}</button>
      <button type="button" aria-label={tr('Закрыть')} title={tr('Закрыть')} onClick={onClose}>×</button>
    </div>
    <TreeDock request={dockRequest} onTabChange={setTab} />
  </div>
}
