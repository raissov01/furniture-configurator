'use client'

/**
 * Жобадағы БАРЛЫҚ шкафты сахнаға дайындау: панельдері + бөлмедегі орны.
 *
 * Белсенді шкафтың қатесін `usePanels` бөлек көрсетеді, ал мұнда жарамсыз
 * конфиг ҮНСІЗ АТТАЛАДЫ: көршілес шкафтың қатесінен бүкіл бөлме жоғалып
 * кетпеуі керек.
 */

import { useMemo } from 'react'
import { ConfigValidationError, generateCabinet, placementPose } from '@/src/core/index'
import type { CabinetConfig, Catalog, Placement, Room } from '@/src/core/index'
import type { SceneItem } from '@/components/Scene'

export function useSceneItems(
  room: Room,
  cabinets: CabinetConfig[],
  placements: Placement[],
  catalog: Catalog,
): SceneItem[] {
  return useMemo(() => {
    const items: SceneItem[] = []
    for (const cabinet of cabinets) {
      const placement = placements.find((p) => p.cabinetId === cabinet.id)
      if (!placement) continue
      try {
        const panels = generateCabinet(cabinet, catalog)
        items.push({ cabinet, panels, placement, pose: placementPose(room, cabinet, placement) })
      } catch (error) {
        if (error instanceof ConfigValidationError) continue
        throw error
      }
    }
    return items
  }, [room, cabinets, placements, catalog])
}
