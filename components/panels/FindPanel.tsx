'use client'

/**
 * «Найти» — жоба бойынша іздеу панелі (`docs/pro100/parity.md` §2.1
 * «Найти» ⚠ ішінара — бұрын тек `ShopSettings.tsx`-тегі декор іздеуі
 * болатын, жалпы нысан іздеуі жоқ еді).
 *
 * Іздеу логикасы `src/core/searchPanels.ts`-те (таза, ГОЧА №1/№2 сонда
 * түсіндірілген). Бұл файл канондық ағаштың панельдерін оқиды, нәтижені көрсетеді, БАСҚАНДА `store/configurator.ts`-тегі
 * БАР таңдау механизмін (`selected`/`setSelected`) қолданады — жаңасын
 * ойлап таппайды (тапсырмадағы талап).
 *
 * ⚠ 3D БӨЛЕКТЕУ ШЕКТЕУІ. `store.selected` қойылса, `components/PanelMesh.tsx`
 * (қазір присадка агентінде) соны оқып, таңдалған панельді 3D-де
 * бөлектейді — бұл қазірдің өзінде жұмыс істейтін жол (`components/Scene.tsx`
 * `selected`-ті пайдаланады). Осы панель тек `setSelected(id)` шақырады,
 * `Scene.tsx`/`PanelMesh.tsx`-ке ТИМЕЙДІ.
 */

import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { panelDisplayLabel } from '@/lib/panelDisplay'
import { useConfigurator } from '@/store/configurator'
import { projectPanelId, searchProjectPanels } from '@/src/core/index'
import { useProjectProduction } from '@/lib/useProjectProduction'
import { cn } from '@/lib/cn'
import { findResultSizes } from '@/lib/f11FindResult'

const rowBase = 'flex w-full flex-col gap-0.5 border border-neutral-800 px-2 py-1.5 text-left text-[11px] transition hover:border-neutral-600'

export function FindPanel() {
  const { scene, catalog, error } = useProjectProduction()
  const selected = useConfigurator((s) => s.selected)
  const setSelected = useConfigurator((s) => s.setSelected)
  const setActive = useConfigurator((s) => s.setActive)

  const [query, setQuery] = React.useState('')

  const items = React.useMemo(() => scene.nodes.map((node) => ({
    cabinetId: node.nodeId,
    panels: node.panels.map((panel) => ({ ...panel,
      id: projectPanelId(node.nodeId, panel.id, scene.nodes.length),
    })),
  })), [scene])
  const hits = React.useMemo(
    () => searchProjectPanels(items, catalog.materials, query),
    [items, catalog.materials, query],
  )
  const cabinetName = (nodeId: string): string =>
    scene.nodes.find((node) => node.nodeId === nodeId)?.name ?? nodeId

  const goTo = (cabinetId: string, panelId: string) => {
    setActive(cabinetId)
    setSelected(panelId)
  }

  if (error) {
    return <div data-panel="find" role="alert" className="border border-[var(--p100-invalid)] bg-[var(--p100-dialog-content)] px-2 py-1 text-xs text-[var(--p100-invalid)]">{error}</div>
  }

  return (
    <div data-panel="find" className="flex h-full flex-col gap-2 bg-[var(--p100-dialog-content)] text-neutral-100">
      <p className="text-[10px] leading-snug text-neutral-500">
        {tr('Поиск по названию, материалу или размеру детали.')}
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tr('Например: полка, 600, Дуб')}
        className="w-full border border-neutral-800 bg-[var(--p100-dialog-content)] px-2 py-1.5 text-[11px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
      />

      {query.trim() ? (
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
          {tr('Найдено деталей')}: {hits.length}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
        {query.trim() && hits.length === 0 ? (
          <p className="text-[11px] text-neutral-600">{tr('Ничего не найдено')}</p>
        ) : (
          hits.map(({ cabinetId, panel }) => {
            const isSelected = selected === panel.id
            const sizes = findResultSizes(panel)
            return (
              <button
                key={`${cabinetId}--${panel.id}`}
                type="button"
                onClick={() => goTo(cabinetId, panel.id)}
                aria-pressed={isSelected}
                className={cn(rowBase, isSelected ? 'border-[var(--p100-focus)] bg-[var(--p100-tool-selected)]' : 'bg-[var(--p100-dialog-content)]')}
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate font-medium">{panelDisplayLabel(panel.label)}</span>
                </span>
                <span className="tabular-nums text-neutral-400">{tr('Готовый')}: {sizes.finished}</span>
                <span className="tabular-nums text-neutral-400">{tr('Рез')}: {sizes.cut}</span>
                <span className="truncate text-neutral-500">
                  {cabinetName(cabinetId)}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
