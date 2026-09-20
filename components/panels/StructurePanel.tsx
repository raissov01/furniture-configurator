'use client'

/**
 * СТРУКТУРА ПРОЕКТЫ — докинг панелі (docs/pro100/ui-design.md §2).
 *
 * PRO100-дағыдай НАҒЫЗ ағаш: топ (жоба) → корпус → деталь. Ағаштың өзі
 * `components/panels/structureTree.ts`-те (`treeFromProject` + `flattenTree`,
 * 09-20 қосылған `src/core/tree.ts` негізінде) — бұл файл тек соны рендерлейді
 * (CLAUDE.md §3: есептеу React-тан бөлек).
 *
 * ⚠ `ModuleList` (components/ModuleList.tsx) ӨШІРІЛМЕДІ — ол негізгі 3D
 * экранда әлі қолданылып тұр, корпус деңгейінде тоқтайтын жалпақ тізім. Бұл
 * панель одан тереңірек түседі: әр корпустың ІШІНДЕГІ детальдары да көрінеді.
 *
 * Таңдау механизмі жаңа емес — `store.setActive`/`store.setSelected`
 * (`store/configurator.ts`, 3D-дегі `PanelMesh.tsx` дәл осыны қолданады).
 * Деталь жолын бассаң, сол деталь «Информация» панелінде де көрінеді —
 * екеуі бір `store.selected` кілтін оқиды.
 */
import { useMemo, useRef, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { ConfigValidationError } from '@/src/core/index'
import type { FlatScene } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { buildProjectScene, flatSceneToRows } from './structureTree'

/** Жарамсыз конфигпен уақытша жұмыс істеп жатқанда (§ `useSceneItems`-тегі
 * ережемен бірдей) соңғы жарамды ағашты көрсетеміз — панель бос қалмайды. */
function useProjectScene(): FlatScene {
  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const catalog = useConfigurator((s) => s.catalog)
  const settings = useConfigurator((s) => s.shop.settings)
  const lastValid = useRef<FlatScene>({ nodes: [], solids: [] })

  return useMemo(() => {
    try {
      const scene = buildProjectScene(room, cabinets, placements, catalog, tr('Жоба'), settings)
      lastValid.current = scene
      return scene
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      return lastValid.current
    }
  }, [room, cabinets, placements, catalog, settings])
}

export function StructurePanel() {
  const activeId = useConfigurator((s) => s.activeId)
  const selected = useConfigurator((s) => s.selected)
  const setActive = useConfigurator((s) => s.setActive)
  const setSelected = useConfigurator((s) => s.setSelected)

  const scene = useProjectScene()
  const rows = useMemo(() => flatSceneToRows(scene), [scene])

  // Әдепкіде бәрі ашық — тереңдігі 2 деңгей ғана (гоча #3), сондықтан
  // 10+ модульде де жол саны басқарымды.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (cabinetId: string) => setCollapsed((s) => ({ ...s, [cabinetId]: !s[cabinetId] }))

  if (rows.length === 0) {
    return (
      <div data-panel="structure" className="text-[11px] text-neutral-500">
        {tr('Жобада корпус жоқ.')}
      </div>
    )
  }

  return (
    <div data-panel="structure" className="flex flex-col gap-0.5 text-[11px]">
      <div className="mb-1 text-neutral-500">
        {tr('Корпус')}: {scene.nodes.length} · {tr('Деталь')}: {scene.nodes.reduce((n, c) => n + c.panels.length, 0)}
      </div>
      {rows.map((row) => {
        if (row.kind === 'cabinet') {
          const isClosed = collapsed[row.cabinetId] === true
          return (
            <div key={row.id} className="flex items-center gap-1.5 rounded px-1 py-1">
              <button
                type="button"
                onClick={() => toggle(row.cabinetId)}
                aria-label={isClosed ? tr('Жаю') : tr('Жию')}
                aria-expanded={!isClosed}
                className={cn('w-3 shrink-0 text-neutral-500 transition-transform', !isClosed && 'rotate-90')}
              >
                ▸
              </button>
              <button
                type="button"
                data-tree-node={row.id}
                onClick={() => setActive(row.cabinetId)}
                className={cn(
                  'flex min-w-0 flex-1 items-baseline gap-1.5 truncate text-left font-medium',
                  row.cabinetId === activeId ? 'text-white' : 'text-neutral-200 hover:text-white',
                )}
              >
                <span className="truncate">{row.label}</span>
              </button>
              <span className="shrink-0 tabular-nums text-neutral-500">{row.partCount}</span>
            </div>
          )
        }

        // ⚠ Гоча #1: жабық болса да DOM-нан алынбайды, тек CSS класымен
        // жасырылады (Collapsible-мен бірдей ереже, components/ui.tsx қара).
        const isClosed = collapsed[row.cabinetId] === true
        return (
          <button
            key={row.id}
            type="button"
            data-tree-node={row.id}
            onClick={() => {
              setActive(row.cabinetId)
              setSelected(row.selectId === selected ? null : row.selectId)
            }}
            className={cn(
              // ⚠ 'flex'/'hidden' БІР-БІРІН АЛМАСТЫРАТЫН жалғыз ту — екеуі
              // қатар тұрса, `.hidden`-нің Tailwind-тегі салмағы жеңіліп,
              // жол көрінбей қалуы керек жерде көрініп қалады (гоча #1).
              isClosed ? 'hidden' : 'flex',
              'items-center gap-1.5 truncate rounded px-1 py-0.5 pl-6 text-left',
              row.selectId === selected ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200',
            )}
          >
            <span className="truncate">{row.label}</span>
            <span className="ml-auto shrink-0 text-[10px] text-neutral-500">{row.roleLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
