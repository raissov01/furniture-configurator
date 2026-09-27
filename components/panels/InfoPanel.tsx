'use client'

/**
 * ИНФОРМАЦИЯ — докинг панелі (docs/pro100/ui-design.md §2, §4 «бір
 * терезеде бәрі»).
 *
 * Таңдау механизмі жаңа емес: `store.selected` (`store/configurator.ts`),
 * дәл сол кілтпен 3D-дегі `PanelMesh.tsx` да, `Workspace.tsx`-тегі
 * ақпарат жолағы да жұмыс істейді (`projectPanelId`, `mergeProjectPanels`,
 * `src/core/generateCabinet.ts`). Бұл панель сол селекторды оқиды ғана.
 *
 * ⚠ CLAUDE.md §4.3: ДАЙЫН (клиент) және РЕЗ (цех) өлшемі екі бөлек жол —
 * ешқашан бір санға араластырылмайды.
 */
import { useMemo } from 'react'
import { t as tr } from '@/lib/i18n'
import { panelDisplayLabel } from '@/lib/panelDisplay'
import { useConfigurator } from '@/store/configurator'
import { useProjectProduction } from '@/lib/useProjectProduction'
import { edgeSummary, groupDrillingByPurpose, materialName, roleLabel } from './infoFields'
import type { EdgeFieldName } from './infoFields'

const EDGE_LABEL: Record<EdgeFieldName, string> = {
  L1: 'передний длинный край',
  L2: 'задний длинный край',
  W1: 'короткий край',
  W2: 'короткий край',
}

export function InfoPanel() {
  const selected = useConfigurator((s) => s.selected)

  const { panels, catalog, error } = useProjectProduction()
  const part = useMemo(() => panels.find((p) => p.id === selected) ?? null, [panels, selected])

  if (error) {
    return <div data-panel="info" role="alert" className="border border-red-900 bg-red-950 px-2 py-1 text-xs text-red-300">{error}</div>
  }

  if (!part) {
    return (
      <div data-panel="info" className="text-[11px] text-neutral-500">
        {tr('Ничего не выбрано — выберите деталь в 3D или панели Структура.')}
      </div>
    )
  }

  const bandById = new Map(catalog.edgeBands.map((b) => [b.id, { name: b.name, thickness: b.thickness }]))
  const edges = edgeSummary(part.edges, bandById)
  const drillGroups = groupDrillingByPurpose(part.drilling)

  return (
    <div data-panel="info" className="flex flex-col gap-2.5 text-[11px]">
      <div>
        <div className="text-sm font-semibold text-white">{panelDisplayLabel(part.label)}</div>
        <div className="text-neutral-500">{roleLabel(part)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-800 pt-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">{tr('Готовый · клиент')}</div>
          <div className="tabular-nums text-neutral-200">{part.finishedLength} × {part.finishedWidth} {tr('мм')}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-amber-500">{tr('Рез · цех')}</div>
          <div className="tabular-nums text-amber-300">{part.cutLength} × {part.cutWidth} {tr('мм')}</div>
        </div>
      </div>

      <div className="border-t border-neutral-800 pt-2">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">{tr('Материал')}</div>
        <div className="text-neutral-200">{materialName(part.materialId, catalog.materials)}</div>
      </div>

      <div className="border-t border-neutral-800 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">{tr('Кромка')}</div>
        <div className="flex flex-col gap-0.5">
          {edges.map((e) => (
            <div key={e.edge} className="flex items-baseline justify-between gap-2">
              <span className="text-neutral-500">{e.edge} ({tr(EDGE_LABEL[e.edge])})</span>
              <span className="text-neutral-200">
                {e.bandName ? `${e.bandName}${e.thickness !== null ? ` (${e.thickness} ${tr('мм')})` : ''}` : tr('нет')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-800 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
          {tr('Присадка')} · {part.drilling.length} {tr('отв.')}
        </div>
        {drillGroups.length === 0 ? (
          <div className="text-neutral-500">{tr('Нет отверстий')}</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {drillGroups.map((g) => (
              <div key={g.purpose} className="flex items-baseline justify-between gap-2">
                <span className="text-neutral-400">{g.label}</span>
                <span className="tabular-nums text-neutral-200">{g.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {part.note ? (
        <div className="border-t border-neutral-800 pt-2 text-neutral-400">{part.note}</div>
      ) : null}
    </div>
  )
}
