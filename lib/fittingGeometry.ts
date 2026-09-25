/** 3D символдарының дерегі тек дайын присадкадан шығады. Өндірістік өлшем есептелмейді. */
import { drillToLocalMarker } from './drillGeometry'
import { SHELF_PIN_PITCH } from '../src/core/constants'
import type { ConstructionSettings, DrillPurpose, EdgeBand, Panel, Vec3 } from '../src/core/types'

export type FittingVisual = {
  purpose: DrillPurpose
  point: Vec3
  /** Панельден сыртқа қараған нормаль. `Drill` материалының ішіне қарайды. */
  normal: Vec3
  diameter: number
  depth: number
  /** Конфирматтың нақты ұзындығы немесе басқа тесік үшін drill depth, мм. */
  length: number
  name: string
  article: string
}

const NAMES: Record<DrillPurpose, string> = {
  confirmat: 'Конфирмат', dowel: 'Шкант', minifix: 'Минификс', shelfPin: 'Полкодержатель',
  hinge: 'Петля', runner: 'Направляющая', handle: 'Ручка', leg: 'Опора',
  facadeScrew: 'Крепление фасада',
}

export function fittingsForPanel(
  panel: Panel, thickness: number, bands: Map<string, EdgeBand>, settings: ConstructionSettings,
  assemblyPanels?: Panel[],
): FittingVisual[] {
  let visibleIndices: Set<number> | null = null
  if (assemblyPanels) {
    visibleIndices = new Set<number>()
    for (const [index, drill] of panel.drilling.entries()) {
      // Бір бұранда face through + edge pilot болып екі Drill операциясынан
      // тұрады; бір минификс cam + shaft/футорка болып бірнеше операция.
      if (drill.purpose === 'confirmat' && drill.face.startsWith('edge')) continue
      if (drill.purpose === 'minifix' && drill.diameter < 12) continue
      if (drill.purpose === 'hinge' && drill.diameter < 30) continue
      // Бұл екі түр PanelMesh/Scene ішіндегі нақты hardware placement-пен
      // салынады; монтаж тесіктері екінші көрінетін тұтқа/аяқ емес.
      if (drill.purpose === 'handle' || drill.purpose === 'leg') continue
      if (drill.purpose !== 'shelfPin') visibleIndices.add(index)
    }

    const shelves = assemblyPanels.filter((part) => part.role === 'shelf')
    const pinRows = new Map<string, number[]>()
    panel.drilling.forEach((drill, index) => {
      if (drill.purpose !== 'shelfPin') return
      const key = `${drill.face}:${drill.y}`
      const row = pinRows.get(key) ?? []
      row.push(index)
      pinRows.set(key, row)
    })
    for (const row of pinRows.values()) {
      const face = panel.drilling[row[0]!]!.face
      for (const shelf of shelves) {
        if (panel.orientation.thickness === 'x') {
          const faceX = panel.position.x + (face === 'inner' ? thickness : 0)
          const shelfSpan = shelf.orientation.length === 'x' ? shelf.finishedLength
            : shelf.orientation.width === 'x' ? shelf.finishedWidth : 0
          const touchesThisSide = Math.abs(shelf.position.x - faceX) <= settings.shelfGap
            || Math.abs(shelf.position.x + shelfSpan - faceX) <= settings.shelfGap
          if (!touchesThisSide) continue
        }
        let nearest: { index: number; distance: number } | null = null
        for (const index of row) {
          const drill = panel.drilling[index]!
          const marker = drillToLocalMarker(panel, drill, thickness, bands, settings)
          const localHeight = panel.orientation.length === 'y' ? marker.point.x
            : panel.orientation.width === 'y' ? marker.point.y : marker.point.z
          const distance = Math.abs(panel.position.y + localHeight - shelf.position.y)
          if (nearest === null || distance < nearest.distance) nearest = { index, distance }
        }
        // 32 мм grid-ке ең жақын тіреу тесігі ғана нақты қолданылып тұр.
        if (nearest && nearest.distance <= SHELF_PIN_PITCH / 2) visibleIndices.add(nearest.index)
      }
    }
  }
  return panel.drilling.flatMap((drill, index): FittingVisual[] => {
    if (visibleIndices && !visibleIndices.has(index)) return []
    const marker = drillToLocalMarker(panel, drill, thickness, bands, settings)
    return [{
      purpose: drill.purpose,
      point: marker.point,
      normal: {
        x: marker.direction.x === 0 ? 0 : -marker.direction.x,
        y: marker.direction.y === 0 ? 0 : -marker.direction.y,
        z: marker.direction.z === 0 ? 0 : -marker.direction.z,
      },
      diameter: drill.diameter,
      depth: drill.depth,
      length: drill.purpose === 'confirmat' ? settings.confirmatScrewLength : drill.depth,
      name: NAMES[drill.purpose] ?? 'Фурнитура',
      article: drill.hardwareId ?? (drill.purpose === 'confirmat' && settings.confirmatScrewLength === 50
        ? 'confirmat-7x50' : 'Артикул не задан'),
    }]
  })
}
