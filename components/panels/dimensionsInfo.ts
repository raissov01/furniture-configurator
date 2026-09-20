/**
 * «Размеры» докинг панелінің ТАЗА логикасы.
 *
 * Өлшем жапсырмаларының өзі `components/DimensionLabels.tsx`-те дайын —
 * әрқашан H×W×D үшеуі бірге, `store.showDimensions` жалауымен қосылады
 * (тек БЕЛСЕНДІ корпусқа, `Scene.tsx`: `active && showDimensions`). Бұл
 * панель сол жалауды басқарады және қазір НАҚТЫ не көрсетіліп тұрғанын
 * (қай корпустың қай сандары) көрсетеді — жеке H/W/D ажыратқышы жоқ, себебі
 * `DimensionLabels` оларды бөліп басқармайды (CLAUDE.md §0.1: рет әрқашан
 * H×W×D).
 */
// ⚠ салыстырмалы жол — `structureTree.ts`-тегі түсініктемені қара (vitest-те `@`-алиасы жоқ).
import type { CabinetConfig } from '../../src/core/index'

export type DimensionRow = { axis: 'H' | 'W' | 'D'; label: string; value: number }

/** Белсенді корпустың H×W×D мәндері, әрқашан осы ретпен (§0.1). */
export function dimensionRows(cabinet: CabinetConfig): DimensionRow[] {
  return [
    { axis: 'H', label: 'Биіктік', value: cabinet.height },
    { axis: 'W', label: 'Ен', value: cabinet.width },
    { axis: 'D', label: 'Тереңдік', value: cabinet.depth },
  ]
}
