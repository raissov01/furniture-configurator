'use client'

/**
 * «Замена» — PRO100-дың материалды ЖАППАЙ ауыстыру панелі
 * (`docs/pro100/parity.md` §2.2 «Материалды жобада жаппай ауыстыру» ❌ —
 * бұрын мүлде жоқ еді, `DecorPicker` тек бір панельге/корпусқа қолданылатын).
 *
 * Логиканың бәрі `src/core/replaceMaterial.ts`-те — бұл файл тек соны
 * шақырады және көрсетеді (CLAUDE.md §3).
 *
 * ⚠ СТОРҒА ТИМЕЙДІ. `store/configurator.ts`-ке жаңа action қоспау үшін
 * (ол жерде бірнеше агент қатар жұмыс істеп жатыр — тапсырмадағы ескерту,
 * әрі ол файл қазір басқа агенттердің де қолында, "M store/configurator.ts"),
 * жобаны жаңарту ZUSTAND-тың ӨЗ статикалық API-імен жүреді:
 * `useConfigurator.setState(...)`. Бұл — `store/configurator.ts`-тегі
 * `loadProject`/`loadKitchen` секілді басқа bulk-жазу әрекеттерімен БІРДЕЙ
 * тәсіл (жаңа `cabinets` + тарихқа снапшот + `future` тазалау), тек сол
 * жерге жаңа код жазбай-ақ. Undo/redo (`store.undo()`/`store.redo()`)
 * осыдан кейін бұрынғыдай жұмыс істейді — олар `past`/`future`
 * массивтерін оқиды ғана, қалай толғанына қарамайды.
 */

import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import {
  ConfigValidationError,
  applyMaterialReplace,
  catalogOf,
  formatTenge,
  previewMaterialReplace,
  projectMaterialUsage,
  rolesLabel,
} from '@/src/core/index'
import type { CabinetConfig, Placement, Room } from '@/src/core/index'
import { DecorPicker } from '@/components/DecorPicker'
import { Button, Toggle } from '@/components/ui'
import { cn } from '@/lib/cn'

/** `store/configurator.ts`-тегі `Snapshot`-пен БІРДЕЙ пішін — undo тарихы соны оқиды. */
type UndoSnapshot = { room: Room; cabinets: CabinetConfig[]; placements: Placement[]; activeId: string }

const rowBase = 'flex items-center justify-between gap-2 border border-neutral-800 px-2 py-1.5 text-[11px]'

export function ReplacePanel() {
  const cabinets = useConfigurator((s) => s.cabinets)
  const shop = useConfigurator((s) => s.shop)
  const catalog = React.useMemo(() => catalogOf(shop), [shop])

  const [oldMaterialId, setOldMaterialId] = React.useState<string | null>(null)
  const [newMaterialId, setNewMaterialId] = React.useState<string | null>(null)
  const [scopeAll, setScopeAll] = React.useState(true)
  const [selectedCabinetIds, setSelectedCabinetIds] = React.useState<Set<string>>(new Set())
  const [justApplied, setJustApplied] = React.useState<string | null>(null)

  const usage = React.useMemo(() => {
    try {
      return { ok: true as const, value: projectMaterialUsage(cabinets, catalog, shop.settings) }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
    }
  }, [cabinets, catalog, shop.settings])

  const scope = React.useMemo(
    () => (scopeAll
      ? { kind: 'all' as const }
      : { kind: 'cabinets' as const, cabinetIds: [...selectedCabinetIds] }),
    [scopeAll, selectedCabinetIds],
  )

  const preview = React.useMemo(() => {
    if (!oldMaterialId || !newMaterialId) return null
    if (oldMaterialId === newMaterialId) return null
    if (scope.kind === 'cabinets' && scope.cabinetIds.length === 0) return null
    try {
      return { ok: true as const, value: previewMaterialReplace(cabinets, shop, oldMaterialId, newMaterialId, scope, shop.settings) }
    } catch (err) {
      if (err instanceof ConfigValidationError) return { ok: false as const, message: err.message }
      throw err
    }
  }, [cabinets, shop, oldMaterialId, newMaterialId, scope])

  const toggleCabinet = (id: string) => {
    setSelectedCabinetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canApply = preview?.ok === true && oldMaterialId && newMaterialId

  const apply = () => {
    if (!canApply || !oldMaterialId || !newMaterialId) return
    useConfigurator.setState((s) => {
      const snapshot: UndoSnapshot = { room: s.room, cabinets: s.cabinets, placements: s.placements, activeId: s.activeId }
      return {
        cabinets: applyMaterialReplace(s.cabinets, oldMaterialId, newMaterialId, scope),
        past: [...s.past, snapshot].slice(-100),
        future: [],
        lastEditKey: null,
      }
    })
    setJustApplied(tr('Заменено.'))
    setOldMaterialId(null)
    setNewMaterialId(null)
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
              materials={shop.materials}
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
        </>
      ) : null}

      {justApplied ? <p className="text-[11px] text-emerald-500">{justApplied}</p> : null}
    </div>
  )
}
