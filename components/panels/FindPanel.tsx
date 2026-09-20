'use client'

/**
 * «Найти» — жоба бойынша іздеу панелі (`docs/pro100/parity.md` §2.1
 * «Найти» ⚠ ішінара — бұрын тек `ShopSettings.tsx`-тегі декор іздеуі
 * болатын, жалпы нысан іздеуі жоқ еді).
 *
 * Іздеу логикасы `src/core/searchPanels.ts`-те (таза, ГОЧА №1/№2 сонда
 * түсіндірілген). Бұл файл тек панельдерді жинайды (`generateCabinet`
 * әр корпус үшін), нәтижені көрсетеді, БАСҚАНДА `store/configurator.ts`-тегі
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
import { useConfigurator } from '@/store/configurator'
import { ConfigValidationError, generateCabinet, searchProjectPanels } from '@/src/core/index'
import type { Panel } from '@/src/core/index'
import { cn } from '@/lib/cn'

const rowBase = 'flex w-full flex-col gap-0.5 border border-neutral-800 px-2 py-1.5 text-left text-[11px] transition hover:border-neutral-600'

export function FindPanel() {
  const cabinets = useConfigurator((s) => s.cabinets)
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const selected = useConfigurator((s) => s.selected)
  const setSelected = useConfigurator((s) => s.setSelected)
  const setActive = useConfigurator((s) => s.setActive)

  const [query, setQuery] = React.useState('')

  /**
   * Корпус бойынша топталған панельдер. `useSceneItems`-тегідей: жарамсыз
   * конфигі бар корпустың панельдерін ЛАҚТЫРМАЙМЫЗ (бос тастаймыз) — іздеу
   * панелі бір қате өріс үшін бүкіл нәтижені жоғалтпауы керек.
   */
  const items = React.useMemo(() => {
    const out: { cabinetId: string; panels: Panel[] }[] = []
    for (const cabinet of cabinets) {
      try {
        out.push({ cabinetId: cabinet.id, panels: generateCabinet(cabinet, catalog, shop.settings) })
      } catch (err) {
        if (!(err instanceof ConfigValidationError)) throw err
        // Осы корпус қазір жарамсыз конфигпен тұр — іздеуге қатыспайды.
      }
    }
    return out
  }, [cabinets, catalog, shop.settings])

  const hits = React.useMemo(
    () => searchProjectPanels(items, shop.materials, query),
    [items, shop.materials, query],
  )

  const cabinetName = (cabinetId: string): string =>
    cabinets.find((c) => c.id === cabinetId)?.name ?? cabinetId

  const goTo = (cabinetId: string, panelId: string) => {
    setActive(cabinetId)
    setSelected(panelId)
  }

  return (
    <div className="flex h-full flex-col gap-2 bg-neutral-950 text-neutral-100">
      <p className="text-[10px] leading-snug text-neutral-500">
        {tr('Поиск по названию, материалу или размеру детали.')}
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tr('Например: полка, 600, Дуб')}
        className="w-full border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[11px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
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
            return (
              <button
                key={`${cabinetId}--${panel.id}`}
                type="button"
                onClick={() => goTo(cabinetId, panel.id)}
                className={cn(rowBase, isSelected ? 'border-neutral-100 bg-neutral-900' : 'bg-neutral-950')}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{panel.label}</span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {panel.finishedLength}×{panel.finishedWidth}
                  </span>
                </span>
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
