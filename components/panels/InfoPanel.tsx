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
import { mergeProjectPanels } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { useSceneItems } from '@/lib/useSceneItems'
import { edgeSummary, groupDrillingByPurpose, materialName, roleLabel } from './infoFields'
import type { EdgeFieldName } from './infoFields'

const EDGE_LABEL: Record<EdgeFieldName, string> = {
  L1: 'L1 (алдыңғы ұзын жиек)',
  L2: 'L2 (артқы ұзын жиек)',
  W1: 'W1 (қысқа жиек)',
  W2: 'W2 (қысқа жиек)',
}

export function InfoPanel() {
  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const selected = useConfigurator((s) => s.selected)

  const items = useSceneItems(room, cabinets, placements, catalog, shop.settings)
  const panels = useMemo(
    () => mergeProjectPanels(items.map((i) => ({ cabinetId: i.cabinet.id, panels: i.panels }))),
    [items],
  )
  const part = useMemo(() => panels.find((p) => p.id === selected) ?? null, [panels, selected])

  if (!part) {
    return (
      <div data-panel="info" className="text-[11px] text-neutral-500">
        {tr('Ештеңе таңдалмаған — 3D-де немесе Структура панелінде детальді бас.')}
      </div>
    )
  }

  const bandById = new Map(catalog.edgeBands.map((b) => [b.id, { name: b.name, thickness: b.thickness }]))
  const edges = edgeSummary(part.edges, bandById)
  const drillGroups = groupDrillingByPurpose(part.drilling)

  return (
    <div data-panel="info" className="flex flex-col gap-2.5 text-[11px]">
      <div>
        <div className="text-sm font-semibold text-white">{part.label}</div>
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
              <span className="text-neutral-500">{EDGE_LABEL[e.edge]}</span>
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
