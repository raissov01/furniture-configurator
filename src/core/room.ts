/**
 * Бөлме мен қабырғалар (C фаза).
 *
 * Бөлме — тікбұрышты еден: X ∈ [0, width], Z ∈ [0, depth], биіктік Y бойымен.
 * Әр шкаф БІР қабырғаға, сол қабырғаның бойымен `offset` мм жерге қойылады.
 *
 * Мұнда жиһаз ГЕОМЕТРИЯСЫ есептелмейді — тек корпустың бөлмедегі ОРНЫ.
 * Панельдерді бұрынғыдай `generateCabinet()` береді, ал `placementPose()`
 * сол панельдер тобын әлемге қай жерге, қай бұрышпен қою керегін айтады.
 *
 * КЕЛІСІМ. Қабырғаның бағыты корпустың АЛДЫ бөлмеге қарайтындай етіп
 * таңдалған. Сондықтан `offset` кейбір қабырғада солдан оңға емес, оңнан
 * солға саналады (айнаны бұрумен емес, бұрумен ғана орналастыру мүмкін
 * болғандықтан). Жоспарда `offset = 0` нүктесі белгіленіп тұрады.
 */

import type { CabinetConfig, Placement, Room, Vec3, WallId } from './types'


export type Wall = {
  id: WallId
  label: string
  /** Осы қабырға бойымен қанша мм орын бар */
  length: number
  /** offset = 0 нүктесі, әлем координатасында (еден деңгейінде) */
  origin: Vec3
  /** Қабырға бойымен бірлік вектор: offset осы бағытта өседі */
  direction: Vec3
  /** Бөлменің ІШІНЕ қараған бірлік нормаль */
  inward: Vec3
  /** Корпусты осы қабырғаға қою үшін Y бойынша бұрыш, ГРАДУС */
  rotationY: number
}


export const WALL_LABELS: Record<WallId, string> = {
  north: 'Верхняя',
  east: 'Правая',
  south: 'Нижняя',
  west: 'Левая',
}

export const DEFAULT_ROOM: Room = { width: 4000, depth: 3000, height: 2700 }

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

/**
 * Төрт қабырға. Бағыт пен бұрыш өзара байланысты: корпустың локал +X осі
 * `direction`-ға, локал +Z осі (алдынан артына) `-inward`-қа түседі.
 * Осы екеуі тек `rotationY` арқылы шығуы үшін бағыттар дәл осылай алынған.
 */
export function roomWalls(room: Room): Wall[] {
  return [
    {
      id: 'north',
      label: WALL_LABELS.north,
      length: room.width,
      origin: v(room.width, 0, 0),
      direction: v(-1, 0, 0),
      inward: v(0, 0, 1),
      rotationY: 180,
    },
    {
      id: 'east',
      label: WALL_LABELS.east,
      length: room.depth,
      origin: v(room.width, 0, room.depth),
      direction: v(0, 0, -1),
      inward: v(-1, 0, 0),
      rotationY: 90,
    },
    {
      id: 'south',
      label: WALL_LABELS.south,
      length: room.width,
      origin: v(0, 0, room.depth),
      direction: v(1, 0, 0),
      inward: v(0, 0, -1),
      rotationY: 0,
    },
    {
      id: 'west',
      label: WALL_LABELS.west,
      length: room.depth,
      origin: v(0, 0, 0),
      direction: v(0, 0, 1),
      inward: v(1, 0, 0),
      rotationY: 270,
    },
  ]
}

export function wallById(room: Room, id: WallId): Wall {
  const wall = roomWalls(room).find((w) => w.id === id)
  if (!wall) throw new Error(`белгісіз қабырға: ${id}`)
  return wall
}

/**
 * Корпустың ЛОКАЛ БАСЫ (алды-төмен-сол бұрышы) әлемде қай жерде тұрады
 * және оны қанша градусқа бұру керек.
 *
 * Локал нүкте (x, y, z) әлемде:
 *   origin + direction·offset + inward·D  +  direction·x + Y·y + (−inward)·z
 * Артқы беті (z = D) дәл қабырға жазықтығына түседі.
 */
export function placementPose(
  room: Room,
  cabinet: CabinetConfig,
  placement: Placement,
): { position: Vec3; rotationY: number } {
  const wall = wallById(room, placement.wall)
  const t = placement.offset
  const d = cabinet.depth
  return {
    position: v(
      wall.origin.x + wall.direction.x * t + wall.inward.x * d,
      // Ілмелі модуль: еденнен көтерілген биіктік. Корпустың ішкі есебі
      // бұдан ӨЗГЕРМЕЙДІ — ол тек бөлмедегі орны.
      placement.elevation ?? 0,
      wall.origin.z + wall.direction.z * t + wall.inward.z * d,
    ),
    rotationY: wall.rotationY,
  }
}

/**
 * Шкафтың ЖОСПАРДАҒЫ (жоғарыдан қараған) осьтерге туралы төртбұрышы, мм.
 * Бұрыштар 90°-қа еселі болғандықтан төртбұрыш әрқашан осьтерге тураланады.
 * Жоспар UI бұрау математикасын қайталамауы үшін осында тұр.
 */
export function placementFootprint(
  room: Room,
  cabinet: CabinetConfig,
  placement: Placement,
): { x: number; z: number; width: number; depth: number } {
  const pose = placementPose(room, cabinet, placement)
  const a = (pose.rotationY * Math.PI) / 180
  const cos = Math.round(Math.cos(a))
  const sin = Math.round(Math.sin(a))
  const xs: number[] = []
  const zs: number[] = []
  for (const lx of [0, cabinet.width]) {
    for (const lz of [0, cabinet.depth]) {
      xs.push(pose.position.x + lx * cos + lz * sin)
      zs.push(pose.position.z - lx * sin + lz * cos)
    }
  }
  const x = Math.min(...xs)
  const z = Math.min(...zs)
  return { x, z, width: Math.max(...xs) - x, depth: Math.max(...zs) - z }
}

/** Қабырға бойындағы алып жатқан аралығы, мм. */
export function placementSpan(cabinet: CabinetConfig, placement: Placement): { start: number; end: number } {
  return { start: placement.offset, end: placement.offset + cabinet.width }
}

export type PlacementIssue = {
  cabinetId: string
  /** UI-да қай өріс жанып тұратынын білу үшін */
  field: 'offset' | 'width' | 'depth' | 'overlap'
  message: string
}

/**
 * Жоспарды тексеру. Бұл ҚАТЕ ЛАҚТЫРМАЙДЫ: сыйыспай тұрған жоспар да
 * көрсетіледі, әйтпесе пайдаланушы шкафты жылжытып жатқанда экран қарайып
 * қалады. Мәселелер тізіммен қайтады, UI оларды көрсетеді.
 */
export function validatePlacements(
  room: Room,
  entries: { cabinet: CabinetConfig; placement: Placement }[],
): PlacementIssue[] {
  const issues: PlacementIssue[] = []
  const walls = new Map(roomWalls(room).map((w) => [w.id, w]))

  for (const { cabinet, placement } of entries) {
    const wall = walls.get(placement.wall)
    if (!wall) continue
    const span = placementSpan(cabinet, placement)

    if (placement.offset < 0) {
      issues.push({ cabinetId: cabinet.id, field: 'offset', message: 'смещение отрицательное' })
    }
    if (span.end > wall.length) {
      issues.push({
        cabinetId: cabinet.id,
        field: 'width',
        message: `не влезает: ${span.end} мм при длине стены ${wall.length} мм`,
      })
    }
    // Тереңдігі қарама-қарсы қабырғадан асып кетсе, бөлмені кесіп өтеді.
    const across = wall.id === 'north' || wall.id === 'south' ? room.depth : room.width
    if (cabinet.depth > across) {
      issues.push({
        cabinetId: cabinet.id,
        field: 'depth',
        message: `глубина ${cabinet.depth} мм больше комнаты (${across} мм)`,
      })
    }
  }

  // Бір қабырғадағы қабаттасу. Тек көршілес жұптарды салыстыру жеткілікті:
  // аралықтар басына қарай сұрыпталған.
  const byWall = new Map<WallId, { cabinet: CabinetConfig; placement: Placement }[]>()
  for (const entry of entries) {
    const list = byWall.get(entry.placement.wall) ?? []
    list.push(entry)
    byWall.set(entry.placement.wall, list)
  }
  for (const list of byWall.values()) {
    const sorted = [...list].sort((a, b) => a.placement.offset - b.placement.offset)
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = placementSpan(sorted[i - 1]!.cabinet, sorted[i - 1]!.placement)
      const curr = placementSpan(sorted[i]!.cabinet, sorted[i]!.placement)
      if (curr.start < prev.end) {
        issues.push({
          cabinetId: sorted[i]!.cabinet.id,
          field: 'overlap',
          message: `пересекается с «${sorted[i - 1]!.cabinet.name}» на ${prev.end - curr.start} мм`,
        })
      }
    }
  }

  return issues
}

/**
 * Қабырғада бос орын қалды ма — жаңа шкафты соңынан қоюға ыңғайлы.
 * Ең соңғы шкафтың артындағы бос аралықты қайтарады.
 */
export function nextFreeOffset(
  room: Room,
  wall: WallId,
  entries: { cabinet: CabinetConfig; placement: Placement }[],
): number {
  const onWall = entries.filter((e) => e.placement.wall === wall)
  if (onWall.length === 0) return 0
  return Math.max(...onWall.map((e) => placementSpan(e.cabinet, e.placement).end))
}
