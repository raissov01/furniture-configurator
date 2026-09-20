'use client'

/**
 * РАЗМЕРЫ — докинг панелі (docs/pro100/ui-design.md §2).
 *
 * Өлшем жапсырмалары дайын (`components/DimensionLabels.tsx`), бір жалау
 * басқарады (`store.showDimensions`, `store/configurator.ts`). Бұл панель
 * сол жалауды қосу/өшіру ретінде көрсетеді ("қосу/өшіру") және белсенді
 * корпустың дәл қазір көрсетіліп тұрған H×W×D сандарын тізеді ("қайсысын
 * көрсету").
 *
 * ⚠ ЖЕКЕ H/W/D ажыратқышы ӘДЕЙІ жоқ: `Scene.tsx`-тегі ереже —
 * `{active && showDimensions ? <DimensionLabels cabinet={item.cabinet} /> : null}`
 * — үшеуі әрқашан БІРГЕ, тек белсенді корпусқа (CLAUDE.md §0.1: H×W×D реті
 * бекітілген). Жоқ функцияны бар сияқты көрсету — жалған UI, сондықтан
 * бұл панель нақ бар мүмкіндікті ғана басқарады.
 */
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import { dimensionRows } from './dimensionsInfo'

export function DimensionsPanel() {
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const cabinet = useConfigurator(activeCabinet)
  const cabinetsCount = useConfigurator((s) => s.cabinets.length)

  const rows = dimensionRows(cabinet)

  return (
    <div data-panel="dimensions" className="flex flex-col gap-2.5 text-[11px]">
      <label className="flex items-center gap-2 text-neutral-300">
        <input
          type="checkbox"
          checked={showDimensions}
          onChange={(e) => setShowDimensions(e.target.checked)}
          className="h-3.5 w-3.5 accent-neutral-100"
        />
        {tr('Показывать габариты в 3D')}
      </label>

      <div className={cn('flex flex-col gap-1', !showDimensions && 'opacity-40')}>
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">
          {tr('Показано для')}: {cabinet.name}
          {cabinetsCount > 1 ? ` (${tr('активный корпус')})` : ''}
        </div>
        {rows.map((r) => (
          <div key={r.axis} className="flex items-baseline justify-between border-b border-neutral-900 py-0.5">
            <span className="text-neutral-500">{r.label} ({r.axis})</span>
            <span className="tabular-nums text-neutral-200">{r.value} {tr('мм')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
