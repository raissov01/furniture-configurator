/** 3D символдарының дерегі тек дайын присадкадан шығады. Өндірістік өлшем есептелмейді. */
import { drillToLocalMarker } from './drillGeometry'
import { SHELF_PIN_PITCH } from '../src/core/constants'
import { DRAWER_SYSTEMS } from '../src/core/drawerSystems'
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
  /** Осы панельдің материалында ғана көрінетін бөлігі, мм. */
  embeddedLength: number
  name: string
  article: string
  /** Жәшіктің нақты бүйір тереңдігінен алынған рельс, тек бірінші бекіту тесігінде. */
  rail?: { center: Vec3; length: number; sideClearance: number; system: 'roller' | 'ball' | 'tandem' } | undefined
}

export type FittingShape = {
  head: [number, number, number]
  shaft: [number, number, number]
  arm: [number, number, number] | null
  plate: [number, number, number] | null
}

/** Мешке арналған шартты пішін; өндірістік координата мен өлшемді өзгертпейді. */
export function fittingShape(item: FittingVisual): FittingShape {
  const d = item.diameter
  const shaft: [number, number, number] = [d, item.embeddedLength, d]
  if (item.purpose === 'hinge' && d >= 30) return {
    head: [d, 2, d], shaft,
    arm: [d, item.depth, d / 2], plate: [d / 2, item.depth, d / 2],
  }
  if (item.purpose === 'minifix' && d >= 12) return {
    head: [d, 3, d], shaft, arm: null, plate: null,
  }
  if (item.purpose === 'runner') return {
    head: [d + 3, 3, d + 3], shaft,
    arm: null, plate: null,
  }
  if (item.purpose === 'shelfPin') return {
    head: [d + 4, 3, d + 4], shaft, arm: null, plate: null,
  }
  return {
    head: [d + (item.purpose === 'confirmat' ? 3 : 1), 3,
      d + (item.purpose === 'confirmat' ? 3 : 1)],
    shaft, arm: null, plate: null,
  }
}

const NAMES: Record<DrillPurpose, string> = {
  confirmat: 'Конфирмат', dowel: 'Шкант', minifix: 'Минификс', shelfPin: 'Полкодержатель',
  hinge: 'Петля', runner: 'Направляющая', handle: 'Ручка', leg: 'Опора',
  facadeScrew: 'Крепление фасада',
}

/** Штанга ұстағыштарының орны ядро шығарған штанганың екі ұшында. */
export function rodBracketCentres(centre: Vec3, length: number): [Vec3, Vec3] {
  return [
    { x: centre.x - length / 2, y: centre.y, z: centre.z },
    { x: centre.x + length / 2, y: centre.y, z: centre.z },
  ]
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
    const normal = {
      x: marker.direction.x === 0 ? 0 : -marker.direction.x,
      y: marker.direction.y === 0 ? 0 : -marker.direction.y,
      z: marker.direction.z === 0 ? 0 : -marker.direction.z,
    }
    const length = drill.purpose === 'confirmat' ? settings.confirmatScrewLength : drill.depth
    const dimensions = { x: panel.finishedLength, y: panel.finishedWidth, z: thickness }
    const travel = (['x', 'y', 'z'] as const).find((axis) => normal[axis] !== 0)!
    const room = normal[travel] > 0 ? marker.point[travel] : dimensions[travel] - marker.point[travel]
    const worldHeight = panel.position.y + marker.point.x
    const drawer = drill.purpose === 'runner' && assemblyPanels && panel.orientation.length === 'y'
      ? assemblyPanels.filter((part) => part.role === 'drawerSide'
        && part.position.y <= worldHeight && worldHeight <= part.position.y + part.finishedLength)
        .sort((a, b) => Math.abs(a.position.x - panel.position.x) - Math.abs(b.position.x - panel.position.x))[0]
      : undefined
    const firstRunnerHole = !panel.drilling.slice(0, index).some((previous) => previous.purpose === 'runner'
      && previous.face === drill.face && previous.x === drill.x)
    const runnerSystem = drill.hardwareId?.includes('roller') ? 'roller'
      : drill.hardwareId?.includes('ball') ? 'ball' : 'tandem'
    const runnerSpec = DRAWER_SYSTEMS[runnerSystem]
    const railLength = drawer ? drawer.finishedWidth + (drill.hardwareId ? runnerSpec.boxDepthSub : 0) : 0
    return [{
      purpose: drill.purpose,
      point: marker.point,
      normal,
      diameter: drill.diameter,
      depth: drill.depth,
      length,
      embeddedLength: Math.max(0, Math.min(length, room)),
      ...(drawer && firstRunnerHole ? { rail: {
        center: { x: marker.point.x, y: drawer.position.z - panel.position.z + railLength / 2,
          z: marker.point.z + normal.z * drill.diameter / 2 },
        length: railLength,
        sideClearance: runnerSpec.sideClearance,
        system: runnerSystem,
      } } : {}),
      name: NAMES[drill.purpose] ?? 'Фурнитура',
      article: drill.hardwareId ?? (drill.purpose === 'confirmat' && settings.confirmatScrewLength === 50
        ? 'confirmat-7x50' : 'Артикул не задан'),
    }]
  })
}
