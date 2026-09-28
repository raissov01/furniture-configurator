import type { DrillPurpose } from '../src/core/types'
import type { DrillMarker3D } from './drillGeometry'

export type ColoredDrillMarker = DrillMarker3D & { purpose: DrillPurpose }
export const drillLegend: { purpose: DrillPurpose; color: string; label: string }[] = [
  { purpose: 'confirmat', color: '#f59e0b', label: 'Конфирмат' },
  { purpose: 'dowel', color: '#8b5cf6', label: 'Шкант' },
  { purpose: 'minifix', color: '#06b6d4', label: 'Минификс' },
  { purpose: 'shelfPin', color: '#22c55e', label: 'Полкодержатель' },
  { purpose: 'hinge', color: '#ef4444', label: 'Петля' },
  { purpose: 'runner', color: '#3b82f6', label: 'Направляющая' },
  { purpose: 'handle', color: '#94a3b8', label: 'Ручка' },
  { purpose: 'leg', color: '#ec4899', label: 'Опора' },
  { purpose: 'facadeScrew', color: '#f97316', label: 'Крепление фасада' },
]
export function markerGroups(markers: ColoredDrillMarker[]): { purpose: DrillPurpose; markers: ColoredDrillMarker[] }[] {
  const groups = new Map<DrillPurpose, ColoredDrillMarker[]>()
  for (const marker of markers) {
    const group = groups.get(marker.purpose) ?? []
    group.push(marker)
    groups.set(marker.purpose, group)
  }
  return [...groups].map(([purpose, items]) => ({ purpose, markers: items }))
}
