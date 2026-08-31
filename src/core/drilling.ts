/**
 * Присадка (§4.9) — 32 мм жүйесі.
 *
 * Координаталар РЕЗ панелінде беріледі: станок кромкасыз, кесілген детальді
 * көреді. Есептеу готовый өлшемде жүргізіледі де, соңында W1/L1 кромкасының
 * қалыңдығы шегеріледі (types.ts-тегі Drill түсініктемесін қара).
 */

import {
  CONFIRMAT_EDGE_DEPTH, CONFIRMAT_EDGE_DIAMETER, CONFIRMAT_FACE_DIAMETER,
  CONFIRMAT_FIRST_OFFSET, CONFIRMAT_MIN_PER_JOINT,
  HINGE_COUNT_BY_HEIGHT, HINGE_CUP_DEPTH, HINGE_CUP_DIAMETER, HINGE_CUP_FROM_EDGE,
  HINGE_END_OFFSET, HINGE_PLATE_DEPTH, HINGE_PLATE_DIAMETER,
  HINGE_PLATE_FROM_FRONT, HINGE_PLATE_HOLE_SPACING,
  RUNNER_FIRST_HOLE_OFFSET, RUNNER_SCREW_DEPTH, RUNNER_SCREW_DIAMETER,
  SHELF_PIN_BACK_OFFSET, SHELF_PIN_DEPTH, SHELF_PIN_DIAMETER, SHELF_PIN_FRONT_OFFSET,
  SHELF_PIN_GROUP, SHELF_PIN_PITCH,
} from './constants'
import { handleBorePoints } from './fittings'
import type { MillingPath } from './milling'
import type { HandleModel, HandleSpec, HingeSystem } from './fittings'
import { subtractedThickness } from './edges'
import { panelExtents } from './geometry'
import type { Axis, ConstructionSettings, Drill, EdgeBand, Panel } from './types'

export type Thickness = (panel: Panel) => number

type Ctx = {
  thickness: Thickness
  bands: Map<string, EdgeBand>
  settings: ConstructionSettings
}

// ── Координата көмекшілері ───────────────────────────────────────────────────

function worldRange(panel: Panel, axis: Axis, t: number): [number, number] {
  const e = panelExtents(panel, t)
  return [panel.position[axis], panel.position[axis] + e[axis]]
}

/** Готовый координатаны РЕЗ координатасына аудару (W1/L1 кромкасын шегеру). */
function toCut(panel: Panel, x: number, y: number, ctx: Ctx): { x: number; y: number } {
  return {
    x: x - subtractedThickness(panel.edges.W1, ctx.bands, ctx.settings),
    y: y - subtractedThickness(panel.edges.L1, ctx.bands, ctx.settings),
  }
}

/** Әлемдегі мәнді панельдің локал x (ұзындық) координатасына аудару. */
const localX = (panel: Panel, world: number): number => world - panel.position[panel.orientation.length]
/** Әлемдегі мәнді панельдің локал y (ен) координатасына аудару. */
const localY = (panel: Panel, world: number): number => world - panel.position[panel.orientation.width]

function pushFace(
  panel: Panel, face: 'inner' | 'outer', x: number, y: number,
  diameter: number, depth: number, purpose: Drill['purpose'], ctx: Ctx,
  hardwareId?: string,
): void {
  const p = toCut(panel, x, y, ctx)
  panel.drilling.push({
    face, x: Math.round(p.x), y: Math.round(p.y), diameter, depth, purpose,
    ...(hardwareId ? { hardwareId } : {}),
  })
}

/**
 * Буын бойындағы тесік орындары. Шеткілері жиектен CONFIRMAT_FIRST_OFFSET,
 * қалғандары солардың арасына тең таралады. Барлығы бүтін мм.
 */
export function spreadAlongJoint(length: number, count: number, endOffset: number): number[] {
  if (count <= 1) return [Math.round(length / 2)]
  const first = endOffset
  const last = length - endOffset
  const step = (last - first) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(first + i * step))
}

function confirmatCount(jointLength: number, settings: ConstructionSettings): number {
  return jointLength > settings.confirmatSpanForThird
    ? CONFIRMAT_MIN_PER_JOINT + 1
    : CONFIRMAT_MIN_PER_JOINT
}

// ── Конфирмат буыны ──────────────────────────────────────────────────────────

/**
 * `edgePanel`-дің торці `facePanel`-дің бетіне тіреледі.
 * Бұранда face панельдің бетінен өтіп (Ø5), edge панельдің торціне кіреді (Ø7×50).
 */
export function confirmatJoint(facePanel: Panel, edgePanel: Panel, ctx: Ctx): void {
  const faceT = ctx.thickness(facePanel)
  const edgeT = ctx.thickness(edgePanel)

  /** Бұранда осі — face панельдің қалыңдық өсі. */
  const screwAxis = facePanel.orientation.thickness
  /** Буын сызығы — екі панельдің де жазықтығында жатқан ортақ өс. */
  const jointAxis = (['x', 'y', 'z'] as Axis[]).find(
    (a) => a !== screwAxis && a !== edgePanel.orientation.thickness,
  )
  if (!jointAxis) throw new Error(`Буын осі табылмады: ${facePanel.id} ↔ ${edgePanel.id}`)

  const [jointStart, jointEnd] = worldRange(edgePanel, jointAxis, edgeT)
  const jointLength = jointEnd - jointStart
  const count = confirmatCount(jointLength, ctx.settings)
  const offsets = spreadAlongJoint(jointLength, count, CONFIRMAT_FIRST_OFFSET)

  // Face панельдегі буын сызығының орны: edge панельдің қалыңдық бойынша ортасы.
  const [edgeMin, edgeMax] = worldRange(edgePanel, edgePanel.orientation.thickness, edgeT)
  const jointLineWorld = (edgeMin + edgeMax) / 2

  // Edge панельдің қай жиегі тірелетінін анықтау: оның қай ұшы face панельге
  // жақын тұр — сол ұш тіреледі.
  const [eMin, eMax] = worldRange(edgePanel, screwAxis, edgeT)
  const [fMin, fMax] = worldRange(facePanel, screwAxis, faceT)
  const atStart = Math.abs(eMin - fMax) < Math.abs(eMax - fMin)
  const alongLength = screwAxis === edgePanel.orientation.length
  const edgeFace: Drill['face'] = alongLength
    ? (atStart ? 'edgeW1' : 'edgeW2')
    : (atStart ? 'edgeL1' : 'edgeL2')

  // Торц бетіндегі x РЕЗ координатасында болуы керек. edgeW*-та x панельдің
  // ені бойымен жүреді → L1 кромкасы шегеріледі; edgeL*-та ұзындығы бойымен → W1.
  const edgeXShift = subtractedThickness(
    alongLength ? edgePanel.edges.L1 : edgePanel.edges.W1,
    ctx.bands, ctx.settings,
  )

  for (const offset of offsets) {
    const alongWorld = jointStart + offset

    // Face панель: Ø5 өтпелі
    const fx = facePanel.orientation.length === jointAxis
      ? localX(facePanel, alongWorld)
      : localX(facePanel, jointLineWorld)
    const fy = facePanel.orientation.width === jointAxis
      ? localY(facePanel, alongWorld)
      : localY(facePanel, jointLineWorld)
    pushFace(facePanel, 'outer', fx, fy, CONFIRMAT_FACE_DIAMETER, faceT, 'confirmat', ctx)

    // Edge панель: Ø7×50 торцке, қалыңдықтың дәл ортасына
    edgePanel.drilling.push({
      face: edgeFace,
      x: Math.round(offset - edgeXShift),
      y: Math.round(edgeT / 2),
      diameter: CONFIRMAT_EDGE_DIAMETER,
      depth: CONFIRMAT_EDGE_DEPTH,
      purpose: 'confirmat',
    })
  }
}

// ── Полкодержатель бағаны ────────────────────────────────────────────────────

/**
 * Жылжымалы сөренің екі жағындағы тік панельге тесік тобы.
 * Толық баған емес — сөре номиналды орнынан жоғары-төмен жылжитындай ғана,
 * әрқашан 32 мм торына түсіріліп.
 */
export function shelfPinHoles(
  verticalPanel: Panel,
  shelf: Panel,
  innerBottomWorldY: number,
  ctx: Ctx,
): void {
  const datum = innerBottomWorldY + ctx.settings.shelfPinDatum

  // Сөре полкодержательдің үстіне ОТЫРАДЫ, сондықтан тор сөренің АСТЫҢҒЫ
  // бетімен есептеледі, ортасымен емес.
  const nearestIndex = Math.round((shelf.position.y - datum) / SHELF_PIN_PITCH)
  const half = Math.floor(SHELF_PIN_GROUP / 2)

  const shelfDepth = shelf.finishedWidth
  const shelfFrontWorldZ = shelf.position.z
  const columns = [
    shelfFrontWorldZ + SHELF_PIN_FRONT_OFFSET,
    shelfFrontWorldZ + shelfDepth - SHELF_PIN_BACK_OFFSET,
  ]

  for (let k = -half; k <= half; k += 1) {
    const worldY = datum + (nearestIndex + k) * SHELF_PIN_PITCH
    for (const worldZ of columns) {
      pushFace(
        verticalPanel, 'inner',
        localX(verticalPanel, worldY),
        localY(verticalPanel, worldZ),
        SHELF_PIN_DIAMETER, SHELF_PIN_DEPTH, 'shelfPin', ctx,
      )
    }
  }
}

// ── Ілгек ────────────────────────────────────────────────────────────────────

export function hingeCount(frontHeight: number): number {
  return HINGE_COUNT_BY_HEIGHT.find((r) => frontHeight <= r.maxHeight)?.count ?? 2
}

/**
 * Фасадқа чашка (Ø35) және оған сәйкес тік панельге планка тесіктері.
 * `hingeSide` — топса қай жақта: 'left' немесе 'right'.
 */
export function hingeHoles(
  front: Panel,
  carcassPanel: Panel | undefined,
  hingeSide: 'left' | 'right',
  ctx: Ctx,
  system?: HingeSystem,
): void {
  // Жүйе берілмесе — §4.9-дағы константалар (ескі шақырулар осылай жүреді).
  const cupDiameter = system?.cupDiameter ?? HINGE_CUP_DIAMETER
  const cupDepth = system?.cupDepth ?? HINGE_CUP_DEPTH
  const cupFromEdge = system?.cupFromEdge ?? HINGE_CUP_FROM_EDGE
  const endOffset = system?.endOffset ?? HINGE_END_OFFSET
  const plateSpacing = system?.plateHoleSpacing ?? HINGE_PLATE_HOLE_SPACING
  const plateFromFront = system?.plateFromFront ?? HINGE_PLATE_FROM_FRONT

  const n = hingeCount(front.finishedLength)
  // Шеткі ілгектер фасадтың үсті мен астынан endOffset, қалғаны аралыққа
  const positions = spreadAlongJoint(front.finishedLength, n, endOffset)

  // Фасадтың локал y-і солдан оңға (ORIENT_FACING), сондықтан:
  const cupY = hingeSide === 'left' ? cupFromEdge : front.finishedWidth - cupFromEdge

  for (const x of positions) {
    pushFace(front, 'inner', x, cupY, cupDiameter, cupDepth, 'hinge', ctx, system?.hardwareId)
  }

  if (!carcassPanel) return
  // Планка бүйірдің ішкі бетінде: алдыңғы жиектен plateFromFront, чашка
  // ортасына симметриялы екі тесік.
  const frontWorldY = front.position.y
  for (const x of positions) {
    const worldY = frontWorldY + x
    for (const d of [-plateSpacing / 2, plateSpacing / 2]) {
      pushFace(
        carcassPanel, 'inner',
        localX(carcassPanel, worldY + d),
        localY(carcassPanel, plateFromFront),
        HINGE_PLATE_DIAMETER, HINGE_PLATE_DEPTH, 'hinge', ctx, system?.plateHardwareId,
      )
    }
  }
}

// ── Тұтқа ────────────────────────────────────────────────────────────────────

/**
 * Тұтқаның ӨТПЕЛІ тесіктері фасадта.
 *
 * Тесік өтпелі болғандықтан беті `outer` — станок фасадты сыртқы бетімен
 * жоғары қаратып бұрғылайды, ал тұтқаның бұрандасы дәл сол жақтан кіреді.
 * Тереңдігі = фасадтың қалыңдығы.
 *
 * Фасадтың локал өстері: x — биіктік бойымен (астынан), y — ені бойымен
 * (сол жақтан). `handleBorePoints` дәл осы тәртіпте қайтарады.
 */
export function handleHoles(
  front: Panel,
  model: HandleModel,
  spec: HandleSpec,
  ctx: Ctx,
): void {
  const points = handleBorePoints(model, spec, front.finishedLength, front.finishedWidth)
  if (points.length === 0) return
  for (const pt of points) {
    pushFace(
      front, 'outer', pt.along, pt.across,
      model.boreDiameter, ctx.thickness(front), 'handle', ctx, model.hardwareId,
    )
  }
}

// ── Направляющая (ящик) ──────────────────────────────────────────────────────

/**
 * Ящиктің направляющаясы бекітілетін тесіктер: тік панельдің ІШКІ бетінде,
 * қораптың астыңғы деңгейінде, алдыңғы жиектен 37 мм-ден бастап.
 *
 * Роликті направляющаның корпустық жартысы қорап ТҮБІНІҢ деңгейінде тұрады —
 * сондықтан биіктік қораптың астынан алынады, фасадтан емес.
 */
export function runnerHoles(
  verticalPanel: Panel,
  boxBottomWorldY: number,
  boxFrontWorldZ: number,
  boxDepth: number,
  ctx: Ctx,
): void {
  // Екі бекіту нүктесі: алдында және артында. Ортаңғысы қысқа
  // направляющада болмайды, сондықтан екеуімен шектелеміз.
  const columns = [
    boxFrontWorldZ + RUNNER_FIRST_HOLE_OFFSET,
    boxFrontWorldZ + boxDepth - RUNNER_FIRST_HOLE_OFFSET,
  ]
  for (const worldZ of columns) {
    pushFace(
      verticalPanel, 'inner',
      localX(verticalPanel, boxBottomWorldY),
      localY(verticalPanel, worldZ),
      RUNNER_SCREW_DIAMETER, RUNNER_SCREW_DEPTH, 'runner', ctx,
    )
  }
}

// ── Фрезеровка ───────────────────────────────────────────────────────────────

/**
 * Фасадтың өрнегін панельге жазу.
 *
 * `millingPaths` фасадтың КӨРІНІСІНДЕ береді (x — ені бойымен, y — биіктігі
 * бойымен), ал панельдің локал өстері керісінше: x — ұзындық (биіктік),
 * y — ен. Сондықтан осьтер ауыстырылады да, `drilling` сияқты РЕЗ
 * кеңістігіне көшіріледі.
 */
export function applyMilling(front: Panel, paths: MillingPath[], ctx: Ctx): void {
  for (const path of paths) {
    front.milling.push({
      closed: path.closed,
      points: path.points.map((pt) => {
        const c = toCut(front, pt.y, pt.x, ctx)
        return { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }
      }),
    })
  }
}

/**
 * РЕЗ координатасының ГОТОВЫЙ координатадағы басы.
 *
 * `drilling` мен `milling` станок үшін РЕЗ кеңістігінде сақталады, ал 3D
 * ЖИНАЛҒАН детальді көрсетеді. Экранда салу үшін осы ығысуды қосу керек —
 * әйтпесе өрнек кромканың қалыңдығына жылжып тұрар еді.
 */
export function cutOrigin(
  panel: Panel,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): { x: number; y: number } {
  return {
    x: subtractedThickness(panel.edges.W1, bands, settings),
    y: subtractedThickness(panel.edges.L1, bands, settings),
  }
}
