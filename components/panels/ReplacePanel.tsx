'use client'

/**
 * «Замена» — PRO100-дың материалды ЖАППАЙ ауыстыру панелі
 * (`docs/pro100/parity.md` §2.2 «Материалды жобада жаппай ауыстыру» ❌ —
 * бұрын мүлде жоқ еді, `DecorPicker` тек бір панельге/корпусқа қолданылатын).
 *
 * Логиканың бәрі `src/core/replaceMaterial.ts`-те — бұл файл тек соны
 * шақырады және көрсетеді (CLAUDE.md §3).
 *
 * Жобалық материал қолдануы мен болжамы канондық ағаштан есептеледі.
 */

import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import {
  ConfigValidationError,
  applyMaterialReplace,
  catalogOf,
  formatTenge,
  projectUsage,
  flattenTree,
  scenePanels,
  rolesLabel,
  walkTree,
} from '@/src/core/index'
import { DecorPicker } from '@/components/DecorPicker'
import { Button, Toggle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { buildMaterialPreview, canApplyMaterialPreview } from '@/lib/f11ReplacePreview'

const rowBase = 'flex items-center justify-between gap-2 border border-neutral-800 px-2 py-1.5 text-[11px]'

export function ReplacePanel() {
  const cabinets = useConfigurator((s) => s.cabinets)
  const root = useConfigurator((s) => s.root)
  const projectCatalog = useConfigurator((s) => s.catalog)
  const projectSettings = useConfigurator((s) => s.projectSettings)
  const layers = useConfigurator((s) => s.layers)
  const replaceFreeBoardMaterial = useConfigurator((s) => s.replaceFreeBoardMaterial)
  const replaceProjectMaterial = useConfigurator((s) => s.replaceProjectMaterial)
  const shop = useConfigurator((s) => s.shop)
  const catalog = React.useMemo(() => catalogOf(shop), [shop])

  const [oldMaterialId, setOldMaterialId] = React.useState<string | null>(null)
  const [newMaterialId, setNewMaterialId] = React.useState<string | null>(null)
  const [scopeAll, setScopeAll] = React.useState(true)
  const [selectedCabinetIds, setSelectedCabinetIds] = React.useState<Set<string>>(new Set())
  const [justApplied, setJustApplied] = React.useState<string | null>(null)
  const [boardOldId, setBoardOldId] = React.useState('')
  const [boardNewId, setBoardNewId] = React.useState('')
  const [boardError, setBoardError] = React.useState<string | null>(null)
  const [applyError, setApplyError] = React.useState<string | null>(null)
  const boardMaterials = React.useMemo(() => {
    const ids = new Set<string>()
    walkTree(root, (node) => { if (node.kind === 'board') ids.add(node.board.materialId) })
    return projectCatalog.materials.filter((material) => ids.has(material.id))
  }, [root, projectCatalog])

  const usage = React.useMemo(() => {
    try {
      return { ok: true as const, value: projectUsage(scenePanels(flattenTree(root, projectCatalog,
        projectSettings ?? shop.settings, layers)), projectCatalog) }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
    }
  }, [root, projectCatalog, projectSettings, shop.settings, layers])

  const scope = React.useMemo(
    () => (scopeAll
      ? { kind: 'all' as const }
      : { kind: 'cabinets' as const, cabinetIds: [...selectedCabinetIds] }),
    [scopeAll, selectedCabinetIds],
  )

  const preview = React.useMemo(() => {
    try {
      const value = buildMaterialPreview({ root, catalog: projectCatalog, shop, oldMaterialId,
        newMaterialId, scope, settings: projectSettings ?? shop.settings, layers })
      return value ? { ok: true as const, value } : null
    } catch (err) {
      if (err instanceof ConfigValidationError) return { ok: false as const, message: err.message }
      throw err
    }
  }, [root, projectCatalog, shop, oldMaterialId, newMaterialId, scope, projectSettings, layers])

  const toggleCabinet = (id: string) => {
    setSelectedCabinetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canApply = preview?.ok === true && canApplyMaterialPreview(preview.value)

  const apply = () => {
    if (!canApply || !oldMaterialId || !newMaterialId) return
    try {
      if (scopeAll) replaceProjectMaterial(oldMaterialId, newMaterialId)
      else useConfigurator.getState().replaceCabinets(
        applyMaterialReplace(useConfigurator.getState().cabinets, oldMaterialId, newMaterialId, scope))
      setApplyError(null); setJustApplied(tr('Заменено.'))
      setOldMaterialId(null); setNewMaterialId(null)
    } catch (cause) { setApplyError(cause instanceof Error ? cause.message : tr('Не удалось заменить материал')) }
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-neutral-950 text-neutral-100">
      <p className="text-[10px] leading-snug text-neutral-500">
        {tr('Заменить один материал на другой одним действием — по всему проекту или по выбранным корпусам (Ctrl+Z отменяет).')}
      </p>

      {/* ── 1. Жобадағы материалдар тізімі, әрқайсысы нешеу детальде ── */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">{tr('Материалы в проекте')}</p>
        {!usage.ok ? (
          <p className="text-[11px] text-amber-500">{usage.message}</p>
        ) : usage.value.materials.length === 0 ? (
          <p className="text-[11px] text-neutral-600">{tr('В проекте нет деталей')}</p>
        ) : (
          <div className="flex max-h-40 flex-col gap-1 overflow-auto">
            {usage.value.materials.map((m) => (
              <button
                key={m.materialId}
                type="button"
                onClick={() => { setOldMaterialId(m.materialId); setNewMaterialId(null) }}
                className={cn(
                  rowBase,
                  'text-left transition hover:border-neutral-600',
                  oldMaterialId === m.materialId ? 'border-neutral-100 bg-neutral-900' : 'bg-neutral-950',
                )}
                title={rolesLabel(m)}
              >
                <span className="truncate">{m.materialName}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">{m.parts} {tr('дет.')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {oldMaterialId ? (
        <>
          {/* ── 2. Жаңа материал ── */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{tr('Новый материал')}</p>
            <DecorPicker
              materials={projectCatalog.materials}
              value={newMaterialId ?? oldMaterialId}
              onChange={setNewMaterialId}
            />
          </div>

          {/* ── 3. Ауқым: бүкіл жоба / таңдалған корпустар ── */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{tr('Область')}</p>
            <Toggle checked={scopeAll} onChange={setScopeAll} label={tr('По всему проекту')} />
            {!scopeAll ? (
              <div className="flex max-h-28 flex-col gap-1 overflow-auto pl-1">
                {cabinets.map((c) => (
                  <Toggle
                    key={c.id}
                    checked={selectedCabinetIds.has(c.id)}
                    onChange={() => toggleCabinet(c.id)}
                    label={c.name || c.id}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* ── 4. Алдын ала көрсету ── */}
          {newMaterialId && oldMaterialId !== newMaterialId ? (
            <div className="flex flex-col gap-1 border border-neutral-800 p-2 text-[11px]">
              {!preview ? (
                <p className="text-neutral-600">{tr('Выберите область')}</p>
              ) : !preview.ok ? (
                <p className="text-amber-500">{preview.message}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">{tr('Деталей изменится')}</span>
                    <span className="tabular-nums">{preview.value.changedPanels} / {preview.value.totalPanels}</span>
                  </div>
                  {preview.value.affectedBoardIds.length > 0 && <p className="text-neutral-400">
                    {tr('Свободных панелей изменится')}: {preview.value.affectedBoardIds.length}
                  </p>}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">{tr('Изменение цены')}</span>
                    <span className={cn('tabular-nums', preview.value.priceDiff > 0 ? 'text-amber-500' : preview.value.priceDiff < 0 ? 'text-emerald-500' : 'text-neutral-300')}>
                      {preview.value.priceDiff > 0 ? '+' : ''}{formatTenge(preview.value.priceDiff)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-500">
                    <span>{tr('Новая сумма')}</span>
                    <span className="tabular-nums">{formatTenge(preview.value.priceAfter)}</span>
                  </div>
                  {preview.value.cutSizeChanged ? (
                    <p className="mt-1 text-amber-500">
                      {tr('Толщина материала другая — размер реза тоже пересчитан (§4.3).')}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <Button active disabled={!canApply} onClick={apply}>{tr('Заменить')}</Button>
          {applyError && <p role="alert" className="text-red-400">{applyError}</p>}
        </>
      ) : null}

      {justApplied ? <p className="text-[11px] text-emerald-500">{justApplied}</p> : null}
      {boardMaterials.length > 0 ? <section className="flex flex-col gap-1 border-t border-neutral-800 pt-2 text-[11px]">
        <p className="text-neutral-400">{tr('Замена материалов свободных панелей')}</p>
        <select className="border border-neutral-700 bg-neutral-950 p-1" aria-label={tr('Материал свободной панели')} value={boardOldId} onChange={(event) => setBoardOldId(event.target.value)}>
          <option value="">{tr('Старый материал')}</option>
          {boardMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
        </select>
        <select className="border border-neutral-700 bg-neutral-950 p-1" aria-label={tr('Новый материал свободной панели')} value={boardNewId} onChange={(event) => setBoardNewId(event.target.value)}>
          <option value="">{tr('Новый материал')}</option>
          {projectCatalog.materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
        </select>
        <Button disabled={!boardOldId || !boardNewId || boardOldId === boardNewId} onClick={() => {
          try { replaceFreeBoardMaterial(boardOldId, boardNewId); setBoardError(null); setJustApplied(tr('Заменено.')) }
          catch (cause) { setBoardError(cause instanceof Error ? cause.message : tr('Не удалось заменить материал')) }
        }}>{tr('Заменить свободные панели')}</Button>
        {boardError && <p role="alert" className="text-red-400">{boardError}</p>}
      </section> : null}
    </div>
  )
}
