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
    // Қабырғаның бұрышына пайдаланушының қосымша бұрышы қосылады.
    rotationY: wall.rotationY + (placement.rotate ?? 0),
  }
}

/**
 * Жоспардағы БҰРЫЛҒАН төртбұрыш: төрт нақты бұрышы.
 *
 * `placementFootprint` осьтерге тураланған АЖШ (AABB) береді, ал бұрылған
 * шкафтың АЖШ-сы шкафтың өзінен ҮЛКЕН. Қабаттасуды сонымен тексерсек,
 * 45°-қа бұрылған екі модуль тимей тұрса да «қабаттасады» деп шығар еді.
 */
export function placementCorners(
  room: Room,
  cabinet: CabinetConfig,
  placement: Placement,
): Vec3[] {
  const pose = placementPose(room, cabinet, placement)
  const a = (pose.rotationY * Math.PI) / 180
  /*
   * ⚠ 90°-қа еселі бұрыштарды ДӘЛ ұстау керек. `Math.cos(Math.PI)` −1 емес,
   * −0.9999999999999999 береді де, 450 мм-лік шкаф жоспарда 450.0000000000001
   * болып шығады. Ондай «құйрық» өлшемді салыстыратын жерде де, тестте де
   * түсініксіз айырма береді, ал ерікті бұрышта ол бәрібір қалады.
   */
  const snap = (n: number): number => {
    if (Math.abs(n) < 1e-9) return 0
    if (Math.abs(n - 1) < 1e-9) return 1
    if (Math.abs(n + 1) < 1e-9) return -1
    return n
  }
  const cos = snap(Math.cos(a))
  const sin = snap(Math.sin(a))
  const out: Vec3[] = []
  for (const [lx, lz] of [[0, 0], [cabinet.width, 0], [cabinet.width, cabinet.depth], [0, cabinet.depth]]) {
    out.push(v(
      pose.position.x + lx! * cos + lz! * sin,
      0,
      pose.position.z - lx! * sin + lz! * cos,
    ))
  }
  return out
}

/**
 * Екі дөңес төртбұрыштың қиылысуы — бөлгіш осьтер әдісі (SAT).
 *
 * Тек ЖАНАСУ қиылысу деп саналмайды: қатарға тұрған екі модуль бір-біріне
 * тіреліп тұрады, ал ол қалыпты жағдай. Сондықтан шек `> EPS`.
 */
const OVERLAP_EPS = 0.5

export function rectanglesOverlap(a: Vec3[], b: Vec3[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p1 = poly[i]!
      const p2 = poly[(i + 1) % poly.length]!
      // Қабырғаның НОРМАЛІ — бөлгіш ось үміткері.
      const axis = { x: -(p2.z - p1.z), z: p2.x - p1.x }
      const len = Math.hypot(axis.x, axis.z)
      if (len < 1e-9) continue
      const ux = axis.x / len
      const uz = axis.z / len
      const project = (poly2: Vec3[]) => {
        const values = poly2.map((p) => p.x * ux + p.z * uz)
        return { min: Math.min(...values), max: Math.max(...values) }
      }
      const pa = project(a)
      const pb = project(b)
      if (pa.max - pb.min <= OVERLAP_EPS || pb.max - pa.min <= OVERLAP_EPS) return false
    }
  }
  return true
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
  /*
   * ⚠ Бұрын мұнда cos/sin БҮТІНГЕ дөңгеленетін: қабырғаның бұрышы 90°-қа
   * еселі болғандықтан ол дұрыс еді әрі дөңгелеу қателігін жоятын. Ерікті
   * бұрыш қосылған соң ол жарамайды — 45°-та дөңгелектелген cos 1 болып,
   * төртбұрыш мүлде басқа жерге кетер еді.
   */
  const xs = placementCorners(room, cabinet, placement).map((p) => p.x)
  const zs = placementCorners(room, cabinet, placement).map((p) => p.z)
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

  // Бір қабырғадағы қабаттасу.
  const byWall = new Map<WallId, { cabinet: CabinetConfig; placement: Placement }[]>()
  for (const entry of entries) {
    const list = byWall.get(entry.placement.wall) ?? []
    list.push(entry)
    byWall.set(entry.placement.wall, list)
  }
  for (const list of byWall.values()) {
    const sorted = [...list].sort((a, b) => a.placement.offset - b.placement.offset)
    /*
     * ⚠ Барлық жұпты салыстырамыз, тек көршілесті ЕМЕС. Себебі ас үйдің
     * үстіңгі қатары төменгінің дәл ҮСТІНДЕ (бірдей offset, бөлек биіктік)
     * тұрады: offset бойынша сұрыпталғанда үстіңгі мен төменгі араласып,
     * көршілес-жұп оптимизациясы шынайы қабаттасуды өткізіп жіберер еді.
     */
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const before = sorted[i]!
        const after = sorted[j]!
        // Тік ауқымдары қиылыспаса — қабаттасу ЖОҚ (үстіңгі мен төменгі
        // қатар бір жоспарда тұрса да, әр биіктікте).
        if (!verticalOverlap(before, after)) continue
        /*
         * БҰРЫЛҒАН модульді қабырға бойындағы аралықпен тексеруге БОЛМАЙДЫ:
         * 45°-қа бұрылған шкаф қабырғаның бойымен кеңірек орын алады, бірақ
         * көршісіне тимеуі мүмкін. Ондай жағдайда нақты төртбұрыштар
         * салыстырылады (SAT), ал жанасу қиылысу деп саналмайды.
         */
        const rotated = (before.placement.rotate ?? 0) !== 0 || (after.placement.rotate ?? 0) !== 0
        if (rotated) {
          const hit = rectanglesOverlap(
            placementCorners(room, before.cabinet, before.placement),
            placementCorners(room, after.cabinet, after.placement),
          )
          if (hit) {
            issues.push({
              cabinetId: after.cabinet.id,
              field: 'overlap',
              message: `пересекается с «${before.cabinet.name}»`,
            })
          }
          continue
        }
        const prev = placementSpan(before.cabinet, before.placement)
        const curr = placementSpan(after.cabinet, after.placement)
        const gap = Math.min(prev.end, curr.end) - Math.max(prev.start, curr.start)
        if (gap > 0) {
          issues.push({
            cabinetId: after.cabinet.id,
            field: 'overlap',
            message: `пересекается с «${before.cabinet.name}» на ${gap} мм`,
          })
        }
      }
    }
  }

  return issues
}

/**
 * Екі модульдің ТІК ауқымы қиылыса ма (еденнен биіктік бойынша).
 *
 * Ас үйдің үстіңгі қатары төменгінің дәл үстінде тұрады: жоспарда іздері
 * бір, бірақ биіктіктері бөлек — сондықтан қабаттасу емес. Ауқым:
 * [ілінген биіктік, + цоколь + корпус]. Столешницаның 40 мм-і елеусіз.
 */
function verticalOverlap(
  a: { cabinet: CabinetConfig; placement: Placement },
  b: { cabinet: CabinetConfig; placement: Placement },
): boolean {
  const range = (e: { cabinet: CabinetConfig; placement: Placement }) => {
    const bottom = e.placement.elevation ?? 0
    return { bottom, top: bottom + (e.cabinet.base?.height ?? 0) + e.cabinet.height }
  }
  const ra = range(a)
  const rb = range(b)
  // Тек ЖАНАСУ (бірінің төбесі екіншісінің табанымен беттесуі) қиылысу емес.
  return Math.min(ra.top, rb.top) - Math.max(ra.bottom, rb.bottom) > 0.5
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
