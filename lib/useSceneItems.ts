'use client'

/**
 * Жобадағы БАРЛЫҚ шкафты сахнаға дайындау: панельдері + бөлмедегі орны.
 *
 * Жарамсыз конфиг сахнаны БОСАТПАУЫ керек. Пайдаланушы «600» дегенді өшіріп
 * «6» деп жазып жатқанда конфиг бір сәт жарамсыз болады — сол сәтте бүкіл
 * бөлме жоғалып кетсе, жұмыс істеу мүмкін емес. Сондықтан әр шкафтың СОҢҒЫ
 * ЖАРАМДЫ панельдері есте сақталады да, қате кезінде солар көрсетіледі
 * (қатенің өзін `usePanels` жолақпен айтады).
 */

import { useMemo, useRef } from 'react'
import { ConfigValidationError, generateCabinet, generateHardware, placementPose } from '@/src/core/index'
import type { CabinetConfig, Catalog, HardwarePlacement, Panel, Placement, Room, SettingsOverride } from '@/src/core/index'
import type { SceneItem } from '@/components/Scene'

export function useSceneItems(
  room: Room,
  cabinets: CabinetConfig[],
  placements: Placement[],
  catalog: Catalog,
  settings?: SettingsOverride,
): SceneItem[] {
  const lastValid = useRef<Map<string, { cabinet: CabinetConfig; panels: Panel[]; hardware: HardwarePlacement[] }>>(new Map())

  return useMemo(() => {
    const items: SceneItem[] = []
    const seen = new Set<string>()

    for (const cabinet of cabinets) {
      const placement = placements.find((p) => p.cabinetId === cabinet.id)
      if (!placement) continue
      seen.add(cabinet.id)

      let entry: { cabinet: CabinetConfig; panels: Panel[]; hardware: HardwarePlacement[] } | undefined
      try {
        entry = {
          cabinet,
          panels: generateCabinet(cabinet, catalog, settings),
          hardware: generateHardware(cabinet, catalog, settings),
        }
        lastValid.current.set(cabinet.id, entry)
      } catch (error) {
        if (!(error instanceof ConfigValidationError)) throw error
        // Соңғы жарамды нұсқасы бар болса — соны көрсетеміз.
        entry = lastValid.current.get(cabinet.id)
      }
      if (!entry) continue

      items.push({
        cabinet: entry.cabinet,
        panels: entry.panels,
        hardware: entry.hardware,
        placement,
        pose: placementPose(room, entry.cabinet, placement),
      })
    }

    // Жойылған шкафтардың панельдерін ұстап тұрудың қажеті жоқ.
    for (const id of [...lastValid.current.keys()]) {
      if (!seen.has(id)) lastValid.current.delete(id)
    }
    return items
  }, [room, cabinets, placements, catalog, settings])
}
