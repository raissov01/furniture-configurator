'use client'

import { useEffect, useRef, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { findNode } from '@/src/core/index'
import type { Catalog, Panel } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { capturePropertiesSession, commitPropertiesName, restorePropertiesSession, type PropertiesSession } from '@/lib/propertiesSession'
import { Configurator } from '@/components/Configurator'
import { BoardProperties } from '@/components/BoardProperties'
import { Button } from '@/components/ui'

export function PropertiesDialog({ nodeId, catalog, panels, boardPanel, error, onClose }: {
  nodeId: string
  catalog: Catalog
  panels: Panel[]
  boardPanel?: Panel | undefined
  error: string | null
  onClose: () => void
}) {
  const root = useConfigurator((s) => s.root)
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const setNodeLocked = useConfigurator((s) => s.setNodeLocked)
  const saveProjectLocally = useConfigurator((s) => s.saveProjectLocally)
  const pushHistory = useConfigurator((s) => s.pushHistory)
  const syncShare = useConfigurator((s) => s.syncShare)
  const node = findNode(root, nodeId)
  const baseline = useRef<PropertiesSession | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  if (baseline.current === null) baseline.current = capturePropertiesSession()

  const cancel = () => {
    if (baseline.current) restorePropertiesSession(baseline.current)
    onClose()
  }
  const apply = (): boolean => {
    const input = dialogRef.current?.querySelector<HTMLInputElement>('[data-properties-name]')
    const currentName = findNode(useConfigurator.getState().root, nodeId)?.name
    if (input && (!input.value.trim() || input.value !== currentName)) {
      const nameError = commitPropertiesName(nodeId, input.value)
      if (nameError) { setActionError(tr(nameError)); return false }
    }
    const saveError = saveProjectLocally()
    if (saveError) { setActionError(saveError); return false }
    pushHistory()
    syncShare()
    baseline.current = capturePropertiesSession()
    setActionError(null)
    return true
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (baseline.current) restorePropertiesSession(baseline.current)
      onClose()
    }
    const onPageHide = () => { if (baseline.current) restorePropertiesSession(baseline.current) }
    window.addEventListener('keydown', handle, true)
    window.addEventListener('pagehide', onPageHide)
    return () => { window.removeEventListener('keydown', handle, true); window.removeEventListener('pagehide', onPageHide) }
  }, [onClose])

  if (!node || (node.kind !== 'cabinet' && node.kind !== 'board')) return null
  const locked = Boolean(node.locked)
  return <div className="p100-dialog-backdrop" data-testid="properties-dialog-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) cancel()
  }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={tr('Свойства')} data-testid="properties-dialog" className="p100-dialog">
      <div className="p100-dialog-title"><strong>{tr('Свойства')}</strong><button type="button" aria-label={tr('Закрыть')} onClick={cancel}>×</button></div>
      <label className="p100-dialog-lock"><input type="checkbox" checked={locked} onChange={(event) => {
        try { setNodeLocked(nodeId, event.target.checked); setActionError(null) }
        catch (cause) { setActionError(cause instanceof Error ? cause.message : tr('Не удалось изменить деталь')) }
      }} />{tr('Заблокировать')}</label>
      {actionError && <p role="alert" className="p100-dialog-error">{actionError}</p>}
      <div className="p100-dialog-body">
        <fieldset disabled={locked}>
          {node.kind === 'board'
            ? <BoardProperties key={node.id} node={node} panel={boardPanel} catalog={catalog} />
            : <Configurator key={node.id} invalidField={error} panels={panels} />}
        </fieldset>
        <label className="p100-dialog-dimensions"><input type="checkbox" checked={showDimensions} onChange={(event) => setShowDimensions(event.target.checked)} />{tr('Показывать размеры')}</label>
      </div>
      <div className="p100-dialog-actions">
        <Button onClick={() => { if (apply()) onClose() }} disabled={Boolean(error)}>{tr('OK')}</Button>
        <Button onClick={cancel}>{tr('Отмена')}</Button>
        <Button onClick={apply} disabled={Boolean(error)}>{tr('Применить')}</Button>
      </div>
    </section>
  </div>
}
