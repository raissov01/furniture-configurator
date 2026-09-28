'use client'

import { useEffect, useRef, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { findNode } from '@/src/core/index'
import type { Catalog, Panel } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { capturePropertiesSession, commitPropertiesName, restorePropertiesSession, type PropertiesSession } from '@/lib/propertiesSession'
import { propertiesDirty, propertiesInvalid, propertiesKeyAction, propertiesProductionReady, propertiesChildModalActive } from '@/lib/propertiesDialogState'
import { hasDraftErrors, updateDraftErrors } from '@/lib/numberDraft'
import { Configurator } from '@/components/Configurator'
import { BoardProperties } from '@/components/BoardProperties'
import { SolidProperties } from '@/components/SolidProperties'
import { AnnotationProperties } from '@/components/AnnotationProperties'
import { propertiesNodeSupported } from '@/lib/propertiesNodeUi'
import { GroupProperties } from '@/components/GroupProperties'
import { Button } from '@/components/ui'
import { useModalLayer } from '@/lib/useModalLayer'

export function PropertiesDialog({ nodeId, catalog, panels, boardPanel, error, onClose }: {
  nodeId: string
  catalog: Catalog
  panels: Panel[]
  boardPanel?: Panel | undefined
  /** Генерация қатесі (`usePanels`): өріс, себебі және рұқсат етілген аралық. */
  error: { field: string; message: string; allowed?: string | undefined } | null
  onClose: () => void
}) {
  const root = useConfigurator((s) => s.root)
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const setNodeLocked = useConfigurator((s) => s.setNodeLocked)
  const saveProjectLocally = useConfigurator((s) => s.saveProjectLocally)
  const pushHistory = useConfigurator((s) => s.pushHistory)
  const syncShare = useConfigurator((s) => s.syncShare)
  const quoteOpen = useConfigurator((s) => s.quoteOpen)
  const drillOpen = useConfigurator((s) => s.drillOpen)
  const galleryOpen = useConfigurator((s) => s.galleryOpen)
  const shopOpen = useConfigurator((s) => s.shopOpen)
  const { zIndex, isTop } = useModalLayer(true, 'properties')
  const node = findNode(root, nodeId)
  const baseline = useRef<PropertiesSession | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  if (baseline.current === null) baseline.current = capturePropertiesSession()
  const [baselineValue, setBaseline] = useState<PropertiesSession>(() => baseline.current!)
  // «Применить» тек нақты өзгеріс болғанда: store иммутабельді, сілтемелер салыстырылады.
  const storeDirty = useConfigurator((s) => propertiesDirty(baselineValue, s))
  const [nameDirty, setNameDirty] = useState(false)
  const [draftErrors, setDraftErrors] = useState<Record<string, boolean>>({})
  const draftInvalid = hasDraftErrors(draftErrors)
  const dirty = storeDirty || nameDirty
  const invalid = propertiesInvalid(error)
  const productionReady = propertiesProductionReady(dirty, Boolean(invalid), draftInvalid)
  const childModalActive = propertiesChildModalActive(quoteOpen, drillOpen, galleryOpen, shopOpen)

  const cancel = () => {
    if (baseline.current) restorePropertiesSession(baseline.current)
    onClose()
  }
  const apply = (): boolean => {
    if (draftInvalid || invalid) return false
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
    const savedBaseline = capturePropertiesSession()
    baseline.current = savedBaseline
    setBaseline(savedBaseline)
    setNameDirty(false)
    setActionError(null)
    return true
  }
  /*
   * Enter = OK, Esc = Отмена (PRO100 сияқты). Ұстағыш `capture` фазасында:
   * Esc 3D таңдауын алып тастайтын жалпы хоткейге жетпеуі керек.
   */
  const latest = useRef({ cancel: () => {}, ok: () => {} })
  latest.current = {
    cancel: () => { if (baseline.current) restorePropertiesSession(baseline.current); onClose() },
    ok: () => { if (!invalid && !draftInvalid && apply()) onClose() },
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!isTop) return

      const state = useConfigurator.getState()
      if (propertiesChildModalActive(state.quoteOpen, state.drillOpen, state.galleryOpen, state.shopOpen)) return
      const target = event.target instanceof Element ? event.target.tagName.toLowerCase() : ''
      const action = propertiesKeyAction({
        key: event.key, target, exactInput: event.target instanceof Element && event.target.hasAttribute('data-exact-mm'), isComposing: event.isComposing,
        shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey,
      })
      if (!action) return
      // Enter тек диалог ішінде (басқа терезедегі өріске тимейміз).
      if (action === 'ok' && !(event.target instanceof Node && dialogRef.current?.contains(event.target))) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (action === 'cancel') latest.current.cancel()
      else latest.current.ok()
    }
    const onPageHide = () => { if (baseline.current) restorePropertiesSession(baseline.current) }
    window.addEventListener('keydown', handle, true)
    window.addEventListener('pagehide', onPageHide)
    return () => { window.removeEventListener('keydown', handle, true); window.removeEventListener('pagehide', onPageHide) }
  }, [isTop])

  if (!node || !propertiesNodeSupported(node.kind)) return null
  const locked = Boolean(node.locked)
  // Фон — МОДАЛДЫ: сыртқа басу ештеңе істемейді (бұрын өзгерісті ескертусіз жоятын, P0-3).
  return <div className="p100-dialog-backdrop" style={{ zIndex }} data-testid="properties-dialog-backdrop">
    <section ref={dialogRef} aria-hidden={childModalActive} onInput={(event) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.hasAttribute('data-properties-name')) setNameDirty(target.value !== node.name)
    }} role="dialog" aria-modal="true" aria-label={tr('Свойства')} data-testid="properties-dialog" className="p100-dialog">
      <div className="p100-dialog-title"><strong>{tr('Свойства')}</strong><button type="button" aria-label={tr('Закрыть')} onClick={cancel}>×</button></div>
      <label className="p100-dialog-lock"><input type="checkbox" checked={locked} onChange={(event) => {
        try { setNodeLocked(nodeId, event.target.checked); setActionError(null) }
        catch (cause) { setActionError(cause instanceof Error ? cause.message : tr('Не удалось изменить деталь')) }
      }} />{tr('Заблокировать')}</label>
      {actionError && <p role="alert" className="p100-dialog-error">{actionError}</p>}
      {invalid && <p role="alert" data-testid="properties-invalid" className="p100-dialog-error p100-dialog-invalid">
        {tr(invalid.label)}: {invalid.detail}{invalid.allowed ? ` — ${tr('допустимо')} ${invalid.allowed}` : ''}
      </p>}
      <div className="p100-dialog-body">
        <div>
          {node.kind === 'annotation' ? <AnnotationProperties key={node.id} node={node} autoApply onDraftValidityChange={(isInvalid) => setDraftErrors((current) => updateDraftErrors(current, 'annotationText', isInvalid))} /> : node.kind === 'group' ? <GroupProperties key={node.id} node={node} /> : node.kind === 'solid' ? <fieldset disabled={locked}><SolidProperties key={node.id} node={node} /></fieldset> : node.kind === 'board'
            ? <BoardProperties key={node.id} node={node} panel={boardPanel} catalog={catalog} locked={locked} productionReady={productionReady} />
            : <Configurator key={node.id} invalidField={error?.field ?? null} panels={panels}
                locked={locked} productionReady={productionReady}
                onDraftValidityChange={(field, isInvalid) => setDraftErrors((current) => updateDraftErrors(current, field, isInvalid))} />}
        </div>
        <label className="p100-dialog-dimensions"><input type="checkbox" checked={showDimensions} onChange={(event) => setShowDimensions(event.target.checked)} />{tr('Показывать размеры')}</label>
      </div>
      <div className="p100-dialog-actions">
        <Button testId="properties-ok" onClick={() => latest.current.ok()} disabled={Boolean(invalid) || draftInvalid} title="Enter">{tr('OK')}</Button>
        <Button testId="properties-cancel" onClick={cancel} title="Esc">{tr('Отмена')}</Button>
        <Button testId="properties-apply" onClick={apply} disabled={Boolean(invalid) || draftInvalid || !dirty}>{tr('Применить')}</Button>
      </div>
    </section>
  </div>
}
