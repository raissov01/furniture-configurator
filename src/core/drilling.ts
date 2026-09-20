/**
 * Присадка (§4.9) — 32 мм жүйесі.
 *
 * Координаталар РЕЗ панелінде беріледі: станок кромкасыз, кесілген детальді
 * көреді. Есептеу готовый өлшемде жүргізіледі де, соңында W1/L1 кромкасының
 * қалыңдығы шегеріледі (types.ts-тегі Drill түсініктемесін қара).
 */

import {
  DRAWER_FACADE_SCREW_DIAMETER, DRAWER_FACADE_SCREW_END_OFFSET,
  DRAWER_FACADE_SCREW_PILOT_DEPTH, DRAWER_FACADE_SCREW_ROW_FRACTIONS,
  CONFIRMAT_EDGE_DEPTH, CONFIRMAT_EDGE_DIAMETER, CONFIRMAT_FACE_DIAMETER,
  CONFIRMAT_FIRST_OFFSET, CONFIRMAT_MIN_EDGE, CONFIRMAT_MIN_PER_JOINT,
  HINGE_COUNT_BY_HEIGHT, HINGE_CUP_DEPTH, HINGE_CUP_DIAMETER, HINGE_CUP_FROM_EDGE,
  HINGE_END_OFFSET, HINGE_PLATE_DEPTH, HINGE_PLATE_DIAMETER,
  HINGE_PLATE_FROM_FRONT, HINGE_PLATE_HOLE_SPACING,
  LEG_CENTRE_FROM_FRONT, LEG_CENTRE_FROM_SIDE, LEG_SCREW_DEPTH, LEG_SCREW_DIAMETER,
  LEG_SCREW_SQUARE, LEG_STEP,
  DRAWER_BOTTOM_DOWEL_DEPTH, DRAWER_BOTTOM_DOWEL_DIAMETER, DRAWER_BOTTOM_DOWEL_FROM_END,
  MINIFIX_CAM_DEPTH, MINIFIX_CAM_DIAMETER, MINIFIX_CAM_FROM_EDGE,
  MINIFIX_DOWEL_DEPTH, MINIFIX_DOWEL_DIAMETER, MINIFIX_FROM_END, MINIFIX_PAIR_SPACING,
  MINIFIX_SCREW_DEPTH, MINIFIX_SCREW_DIAMETER,
  RUNNER_FIRST_HOLE_OFFSET, RUNNER_SCREW_DEPTH, RUNNER_SCREW_DIAMETER,
  RUNNER_TANDEM_DEPTH, RUNNER_TANDEM_DIAMETER, RUNNER_TANDEM_OFFSETS,
  SHELF_PIN_BACK_OFFSET, SHELF_PIN_DEPTH, SHELF_PIN_DIAMETER, SHELF_PIN_FRONT_OFFSET,
  SHELF_PIN_GROUP, SHELF_PIN_PITCH,
} from './constants'
import { handleBorePoints } from './fittings'
import type { MillingPath } from './milling'
import type { HandleModel, HandleSpec, HingeSystem } from './fittings'
import { subtractedThickness } from './edges'
import { panelExtents } from './geometry'
import type { Axis, ConstructionSettings, Drill, EdgeBand, Panel } from './types'
import type { DrawerSystem } from './drawerSystems'

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

/**
 * 0.1 мм-ге дөңгелектеу. CLAUDE.md §0.2 «бүтін мм» ережесі ДЕТАЛЬДІҢ өлшеміне
 * қатысты (кесу ұзындығы/ені) — бұл координата басқа нәрсе. Кромка
 * қалыңдығы (`EdgeBand.thickness`) бүтін мм болмауы мүмкін (каталогта
 * шектеусіз), ал беттегі де (`toCut`), торцтағы да (`edgeXShiftFor`/
 * `subtractedThickness`) координатадан осы шама шегеріледі: бүтін мм-ге
 * дейін дөңгелектесе, 0.5 мм-ге дейін жоғалады. §4.9-да ілгек тереңдігі
 * 12,5 мм болып ерекшелік ретінде жазылған — бұл доменде 1 мм-ден жіңішке
 * дәлдік бұрыннан рұқсат етілген (Аудит Y5, docs/audit/drilling-2026-09-20.md).
 *
 * ⚠ `pushFace`-те ҒАНА ЕМЕС: бір буынның БЕТ тесігі мен ТОРЦ тесігі бір
 * физикалық нүкте болғанда (мыс. `minifixJoint`, `confirmatJoint`), екеуі
 * ДӘЛ бір санмен сәйкес келуі керек — сондықтан осы функция барлық ТІКЕЛЕЙ
 * `drilling.push` шақыруларында да қолданылады, тек `pushFace`-те емес.
 */
function roundCoord(value: number): number {
  return Math.round(value * 10) / 10
}

function pushFace(
  panel: Panel, face: 'inner' | 'outer', x: number, y: number,
  diameter: number, depth: number, purpose: Drill['purpose'], ctx: Ctx,
  hardwareId?: string,
): void {
  const p = toCut(panel, x, y, ctx)
  panel.drilling.push({
    face, x: roundCoord(p.x), y: roundCoord(p.y), diameter, depth, purpose,
    ...(hardwareId ? { hardwareId } : {}),
  })
}

/**
 * Буын бойындағы тесік орындары. Шеткілері жиектен CONFIRMAT_FIRST_OFFSET,
 * қалғандары солардың арасына тең таралады. Барлығы бүтін мм.
 *
 * ⚠ ҚЫСҚА БУЫН. Шегініс буынның ҮШТЕН БІРІНЕН аспайды. Онсыз 95 мм буында
 * (цоколь қорабының бұрышы) `spreadAlongJoint(95, 2, 50)` → `[50, 45]`
 * шығатын: екі тесік бір-бірінің үстінде, әрі реті теріс. Ұзын буында
 * ештеңе өзгермейді — 150 мм-ден бастап `length / 3 ≥ 50`.
 */
export function spreadAlongJoint(length: number, count: number, endOffset: number): number[] {
  if (count <= 1) return [Math.round(length / 2)]
  const first = Math.min(endOffset, length / 3)
  const last = length - first
  const step = (last - first) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(first + i * step))
}

function confirmatCount(jointLength: number, settings: ConstructionSettings): number {
  /*
   * ТЫМ ҚЫСҚА БУЫНҒА БІР ҒАНА конфирмат.
   *
   * Екеуін сыйғызу үшін буын кемінде 3 × CONFIRMAT_MIN_EDGE болуы керек
   * (жиекке дейін, екеуінің арасына, тағы жиекке дейін). Одан қысқасында
   * тесіктер жиекке тым жақын отырады да, ЛДСП жарылады — бұрандасы жоқ
   * бұрыштан гөрі, жарылған деталь қымбатқа түседі.
   *
   * Айналып кетуден қорықпайды: бұл ереже іс жүзінде цоколь қорабының
   * бұрышы сияқты жерде ғана істейді, ал ондай қорапты төрт бұрыш ұстайды.
   */
  if (jointLength < 3 * CONFIRMAT_MIN_EDGE) return 1
  const span = settings.confirmatSpanForThird
  // `null` — ереже ӨШІРУЛІ: ұзын буында да екі конфирмат (types.ts қара).
  return span !== null && jointLength > span
    ? CONFIRMAT_MIN_PER_JOINT + 1
    : CONFIRMAT_MIN_PER_JOINT
}

// ── Торц буындарының ортақ көмекшілері ──────────────────────────────────────

/**
 * Штифт/бұранда `edgePanel`-дің торціне қай жиекте кіретінін анықтайды.
 *
 * `screwAxis` — штифттің/бұранданың бағыты (әдетте екінші панельдің
 * қалыңдық өсі — ол панельдің бетінен өтіп, осы `edgePanel`-дің торціне
 * кіреді). Торц панельдің `orientation.length` осінің ұшында тұрса (яғни
 * штифт сол өс бойымен жүреді) — бұл W1/W2 (types.ts §76-77: W1/W2 —
 * ұзындықтың екі ұшы), әйтпесе — L1/L2.
 *
 * ⚠ БҰРЫН минификс буындарында (`minifixJoint`, `drawerBottomJoints`) бұл
 * әрқашан ТҰРАҚТЫ `edgeW1/edgeW2` болатын — тек `edgePanel.orientation`
 * сәйкес келгенде ғана дұрыс шығатын (қорап дносында кездейсоқ дұрыс, ал
 * ORIENT_FACING қабырғада қате: сол/оң тік жиектің орнына үсті/асты
 * жазылатын). Аудит: `docs/audit/drilling-2026-09-20.md` §R2.
 */
function edgeFaceFor(edgePanel: Panel, screwAxis: Axis, atStart: boolean): Drill['face'] {
  const alongLength = screwAxis === edgePanel.orientation.length
  return alongLength
    ? (atStart ? 'edgeW1' : 'edgeW2')
    : (atStart ? 'edgeL1' : 'edgeL2')
}

/**
 * Торц бетіндегі x РЕЗ координатасынан шегерілетін кромка қалыңдығы.
 * edgeW*-та x панельдің ені бойымен жүреді → L1 кромкасы шегеріледі;
 * edgeL*-та ұзындығы бойымен → W1.
 */
function edgeXShiftFor(edgePanel: Panel, screwAxis: Axis, ctx: Ctx): number {
  const alongLength = screwAxis === edgePanel.orientation.length
  return subtractedThickness(
    alongLength ? edgePanel.edges.L1 : edgePanel.edges.W1,
    ctx.bands, ctx.settings,
  )
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

  /*
   * Буын ұзындығы — ЕКІ панельдің де `jointAxis` бойындағы қиылысы, тек
   * `edgePanel`-дің өз ұзындығы емес (docs/audit/corner-2026-09-20.md §C1 /
   * drilling-fix-plan.md K3). Түзу шкафта `facePanel` (крышка/дно) сол
   * осьте `edgePanel`-мен (боковина) бірдей аралықта тұрады, сондықтан
   * қиылыс толық ұзындықты береді — бұл жерде ештеңе өзгермейді. Бұрыштық
   * шкафта `side-right` тек өз тереңдігінде тұрады (мыс. 250..600), ал
   * дно бүкіл тереңдікте (0..600) — ескі код дноның ТОЛЫҚ ұзындығын алатын,
   * нәтижесінде материал жоқ жерге (0..250) тесік түсетін.
   */
  const [edgeStart, edgeEnd] = worldRange(edgePanel, jointAxis, edgeT)
  const [faceStart, faceEnd] = worldRange(facePanel, jointAxis, faceT)
  const jointStart = Math.max(edgeStart, faceStart)
  const jointEnd = Math.min(edgeEnd, faceEnd)
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
  const edgeFace = edgeFaceFor(edgePanel, screwAxis, atStart)
  const edgeXShift = edgeXShiftFor(edgePanel, screwAxis, ctx)

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

    // Edge панель: Ø7×50 торцке, қалыңдықтың дәл ортасына. Edge панельдің
    // ӨЗ локал координатасы `alongWorld − edgeStart` — `offset` буынның
    // басынан (`jointStart`) өлшенеді, ал `jointStart` енді `edgeStart`-пен
    // сәйкес келмеуі мүмкін (қиылыс edge панельдің басынан ілгері басталуы
    // мүмкін, жоғарыдағы K3 түзетуін қара).
    edgePanel.drilling.push({
      face: edgeFace,
      x: roundCoord(alongWorld - edgeStart - edgeXShift),
      y: roundCoord(edgeT / 2),
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

  /*
   * Баған СӨРЕНІҢ емес, тесік бұрғыланатын ТІК ПАНЕЛЬДІҢ өз жиегінен
   * алынады (docs/audit/corner-2026-09-20.md §C2 / drilling-fix-plan.md K4).
   * Бұрыштық шкафта сөре трапеция болғандықтан оның `finishedWidth`-і сол
   * жақтың толық тереңдігімен (мыс. 600) тең, ал `side-right` тек өз
   * тереңдігінде (мыс. 350) тұрады — сөреден алса, алдыңғы баған оң
   * бүйірде теріс координатаға шығады. Түзу шкафта екі есеп те бірдей
   * нәтиже береді, себебі сонда тік панель мен сөре тереңдігі тең.
   */
  const verticalT = ctx.thickness(verticalPanel)
  const [panelFrontWorldZ, panelBackWorldZ] = worldRange(
    verticalPanel, verticalPanel.orientation.width, verticalT,
  )
  const columns = [
    panelFrontWorldZ + SHELF_PIN_FRONT_OFFSET,
    panelBackWorldZ - SHELF_PIN_BACK_OFFSET,
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
  /*
   * Планка тік панельдің КЕҢ бетіне бұрғыланады: алдыңғы жиектен
   * plateFromFront, чашка ортасына симметриялы екі тесік.
   *
   * ⚠ §R4 түзетуі (docs/audit/drilling-2026-09-20.md). Бүйір панельдің
   * (side-left/side-right) тек БІР ғана көрші секциясы бар, сондықтан
   * планка әрқашан 'inner' бетіне түседі — бұл ескі мінез, өзгермейді.
   *
   * Перегородканың ЕКІ жағында да секция бар: солай болғандықтан ескі
   * «inner әрқашан ішке қарайды» деген жорамал бұзылады —
   * екі бет те бірдей «ішке» қарайды. `generateCabinet.ts`-те `hingeHoles`
   * әр секцияның шеткі фасадына бөлек шақырылады (`boundsOf` арқылы), әрі
   * сол бір перегородка екі шақыруда да ДӘЛ СОЛ `carcassPanel` болып келеді
   * (divider-N — i-ші секцияның оң шегі де, i+1-ші секцияның сол шегі де).
   * Ескі кодта екеуі де 'inner'-ге жазылатын да, координата (фасад биіктігі
   * бойынша) кездейсоқ сәйкес келгенде бір-бірінің үстіне түсетін.
   *
   * Перегородканың екі кең беті геометриялық тұрғыда бұрыннан inner/outer
   * болып ажыратылған: `orientation.thickness` осі бойынша (дивайдерде —
   * ORIENT_SIDE, thickness = 'x') панель [position, position+t] аралығын
   * алады. Локал +қалыңдық жағы (world x = position+t, панельдің «арғы»
   * беті) — inner, қарсы жақ (world x = position, панельдің «бергі» беті)
   * — outer (types.ts-тегі Drill түсініктемесін қара). Фасадтың орталығы
   * осы аралықтың қай жағында тұрғанына қарай екі секцияның планкасы екі
   * бөлек бетке бөлінеді: перегородканың оң жағындағы секция — inner,
   * сол жағындағы секция — outer. Бүйір панельде (thickness осінің бір
   * ұшы 0-де, екіншісі W-де тұрады) фасад әрқашан «арғы» жақта болады,
   * сондықтан формула да, ескі мінез де сәйкес келеді — side-left үшін
   * әрқашан inner. side-right үшін фасад әрқашан «бергі» жақта тұрғандықтан
   * формула 'outer' береді: бұл ЕСКІ ЖАЛҒАН МІНЕЗДІ түзетеді (side-right
   * планкасы да бұрын қате 'inner' болатын, тек бүйірде екінші сектор
   * болмағандықтан ешкім қақтығыспайтын, сондықтан байқалмаған).
   */
  const carcassThickness = ctx.thickness(carcassPanel)
  const thicknessAxis = carcassPanel.orientation.thickness
  const carcassFarFace = carcassPanel.position[thicknessAxis] + carcassThickness
  // Фасадтың ені де дәл сол осьте жатыр (ORIENT_FACING.width === 'x' ===
  // ORIENT_SIDE.thickness) — жоба бойынша тұрақты, generateCabinet.ts-те
  // ешқашан өзгермейді.
  const frontCentre = front.position[thicknessAxis] + front.finishedWidth / 2
  const plateFace: 'inner' | 'outer' = frontCentre >= carcassFarFace ? 'inner' : 'outer'

  const frontWorldY = front.position.y
  for (const x of positions) {
    const worldY = frontWorldY + x
    for (const d of [-plateSpacing / 2, plateSpacing / 2]) {
      pushFace(
        carcassPanel, plateFace,
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
  system?: DrawerSystem | null,
): void {
  /*
   * Тесіктің схемасы направляющаның ЖҮЙЕСІНЕН алынады (`drawerSystems.ts`).
   * Жүйе таңдалмаса — Blum Tandem-нің схемасы, ол qdesign-нің CNC экспортынан
   * өлшенген: алдыңғы жиектен 83 мм, сосын 32 мм жүйесімен 64 + 64 + 32.
   *
   * Қораптан ұзын тесік бұрғыланбайды: қысқа ящикте соңғы нүктелер қорапта
   * жоқ, ал жоқ жерге бұрғылау — панельдің сыртына шығу.
   */
  const offsets = system ? system.holeOffsets : RUNNER_TANDEM_OFFSETS
  const columns = offsets
    .filter((offset) => offset <= boxDepth)
    .map((offset) => boxFrontWorldZ + offset)

  // Бірде-бір нүктесі сыймаса (өте қысқа ящик), екі нүктелі схемамен
  // қаламыз — направляющая бәрібір бір нәрсеге бекітілуі керек.
  const fallback = [
    boxFrontWorldZ + RUNNER_FIRST_HOLE_OFFSET,
    boxFrontWorldZ + boxDepth - RUNNER_FIRST_HOLE_OFFSET,
  ]
  const points = columns.length > 0 ? columns : fallback
  const [diameter, depth] = columns.length > 0
    ? [
      system ? system.holeDiameter : RUNNER_TANDEM_DIAMETER,
      system ? system.holeDepth : RUNNER_TANDEM_DEPTH,
    ]
    : [RUNNER_SCREW_DIAMETER, RUNNER_SCREW_DEPTH]

  for (const worldZ of points) {
    pushFace(
      verticalPanel, 'inner',
      localX(verticalPanel, boxBottomWorldY),
      localY(verticalPanel, worldZ),
      // Артикул тесікте жүреді: смета осыдан ҚАЙ направляющая екенін біледі
      // (ілгек пен тұтқада да дәл солай).
      diameter, depth, 'runner', ctx, system?.hardwareId,
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


/**
 * Ящиктің фасадын қорапқа бекітетін еврошуруптар.
 *
 * Бұрын бізде бұл МҮЛДЕ жоқ еді: направляющаяның тесіктері бар, ал фасадты
 * қорапқа не ұстайтыны айтылмайтын. Цех оны қолмен өлшеп бұрғылайтын, ал
 * фасад қисайса — ол клиенттің көзіне бірінші түсетін жер.
 *
 * Схема (`constants.ts`-тегі сандардың дереккөзі сонда жазылған):
 *   • бұранда ҚОРАПТЫҢ ІШІНЕН алдыңғы қабырғаны тесіп өтеді;
 *   • фасадқа тек ПИЛОТ тесік — 3 мм, тесіп шықпайды;
 *   • төрт нүкте: қабырға биіктігінің 1/3 пен 2/3-інде, әр ұшынан шегініп.
 *
 * `wall` мен `facade` — ORIENT_FACING панельдері: локал x — БИІКТІК,
 * локал y — ЕН (types.ts қара). Сондықтан биіктік x-ке, ен y-ке түседі.
 */
export function drawerFacadeScrews(wall: Panel, facade: Panel, ctx: Ctx): void {
  const wallThickness = ctx.thickness(wall)
  const wallHeight = wall.finishedLength
  const wallWidth = wall.finishedWidth

  // Тар ящикте 80 мм сыймайды: сонда шегініс ЕНнің төрттен біріне дейін
  // қысылады — тесік әрқашан қабырғаның ішінде қалуы керек.
  const offset = Math.min(DRAWER_FACADE_SCREW_END_OFFSET, Math.floor(wallWidth / 4))
  const columns = [offset, wallWidth - offset]
  const rows = DRAWER_FACADE_SCREW_ROW_FRACTIONS.map((f) => Math.round(wallHeight * f))

  for (const x of rows) {
    for (const y of columns) {
      // Қораптың ІШКІ бетінен бұрғыланады да, қабырғаны тесіп өтеді.
      pushFace(wall, 'inner', x, y, DRAWER_FACADE_SCREW_DIAMETER, wallThickness, 'facadeScrew', ctx)

      /*
       * Фасадтағы жұбы — ДӘЛ сол физикалық нүкте, бірақ фасадтың өз
       * координатасында. Екі панель де ORIENT_FACING болғандықтан аудару
       * әлем осьтері арқылы жүреді: биіктік — Y, ен — X.
       */
      const worldY = wall.position.y + x
      const worldX = wall.position.x + y
      const facadeX = worldY - facade.position.y
      const facadeY = worldX - facade.position.x
      if (facadeX < 0 || facadeX > facade.finishedLength) continue
      if (facadeY < 0 || facadeY > facade.finishedWidth) continue
      pushFace(
        facade, 'inner', facadeX, facadeY,
        DRAWER_FACADE_SCREW_DIAMETER, DRAWER_FACADE_SCREW_PILOT_DEPTH, 'facadeScrew', ctx,
      )
    }
  }
}


/**
 * Реттелетін аяқтардың бекітілуі: дноның АСТЫҢҒЫ бетіне, әр аяққа төрт
 * бұранда 65 × 65 мм шаршымен.
 *
 * Бұрын бізде аяқ тек сметада тұратын — цех оны қайда бұрағанын өзі шешетін.
 * Ал аяқтың орны корпустың тұрақтылығын шешеді: шетке тым жақын қойса,
 * жиһаз шайқалады.
 *
 * `legPairs` — аяқтардың ЖҰБЫ (алдыңғы-артқы), ені бойынша қанша тұрғаны;
 * ол `hardware.ts`-те есептеледі де, екеуі бір саннан жүреді.
 */
/**
 * Аяқ жұптарының саны.
 *
 * Әр 600 мм-ге бір жұп: одан кең корпустың дносы ортасынан майысады, ал
 * майысқан дно ящиктің направляющасын қысады. Кемінде екі жұп — төрт аяқ.
 */
export function legPairsFor(width: number, step: number = LEG_STEP): number {
  return Math.max(2, Math.ceil(width / step))
}

/**
 * Аяқтардың ОРТАЛАРЫ, кабинеттің сыртқы габаритінде (X — ені, Z — тереңдігі).
 *
 * ⚠ Бұл функция БІРЕУ, әрі әдейі солай: аяқтың бұрандасы (присадка) мен
 * 3D-дегі аяқтың өзі бір нүктеден алынады. Екі жерде бөлек есептелсе, олар
 * бір-бірінен жылжып кетер еді де, клиент 3D-де бір жерде тұрған аяқтың
 * сызбада басқа жерге бұрғыланғанын тек цехта білер еді.
 */
export function legCentres(
  width: number,
  depth: number,
  legPairs: number,
): { x: number; z: number }[] {
  const first = LEG_CENTRE_FROM_SIDE
  const last = width - LEG_CENTRE_FROM_SIDE
  if (last <= first) return []
  const xs = legPairs <= 1
    ? [(first + last) / 2]
    : Array.from({ length: legPairs }, (_, i) => first + ((last - first) * i) / (legPairs - 1))

  const zs = [LEG_CENTRE_FROM_FRONT, depth - LEG_CENTRE_FROM_FRONT]
  if (zs[1]! <= zs[0]!) return []

  return xs.flatMap((x) => zs.map((z) => ({ x, z })))
}

/**
 * Аяқтың бұрандалары.
 *
 * `offset` — дноның кабинеттегі орны: дно ВКЛАДНОЙ болса, оның нөлі
 * корпустың нөлінен `t` мм жылжыған, ал аяқ корпустың сыртқы жиегінен
 * саналады. Осы шегеру болмаса, вкладной дноның саңылаулары бір қалыңдыққа
 * қисайып бұрғыланар еді.
 */
export function legScrewHoles(
  bottom: Panel,
  legPairs: number,
  ctx: Ctx,
  offset: { x: number; z: number } = { x: 0, z: 0 },
  holeSpacing: number = LEG_SCREW_SQUARE,
): void {
  const length = bottom.finishedLength
  const width = bottom.finishedWidth
  const half = holeSpacing / 2

  const centres = legCentres(length + offset.x * 2, width + offset.z * 2, legPairs)

  for (const centre of centres) {
    const cx = centre.x - offset.x
    const cy = centre.z - offset.z
    for (const dx of [-half, half]) {
      for (const dy of [-half, half]) {
        const x = Math.round(cx + dx)
        const y = Math.round(cy + dy)
        if (x < 0 || x > length || y < 0 || y > width) continue
        // Аяқ дноның АСТЫНА бұралады, сондықтан сыртқы бет.
        pushFace(bottom, 'outer', x, y, LEG_SCREW_DIAMETER, LEG_SCREW_DEPTH, 'leg', ctx)
      }
    }
  }
}


/**
 * МИНИФИКС буыны: ящиктің қорабын (немесе цоколь қорабының бұрышын) жинайды.
 *
 * Бұрын қораптың буындарында присадка МҮЛДЕ жоқ еді — цех оны қолмен өлшеп
 * бұрғылайтын, ал қорап қисайса, ящик тартылмай қалады.
 *
 * `wall` — көлденең панель (қораптың алдыңғы не артқы қабырғасы): оның
 * бетінде эксцентриктің ұясы, торцінде штифттің тесігі.
 * `side` — қораптың бүйірі: оның бетінде штифт бұралатын Ø5.
 *
 * Екі стяжка қойылады: буын сызығы бойымен ортадан 32 мм-ге ажыратылып
 * (`MINIFIX_PAIR_SPACING`) — бір стяжка панельді айналдырып жібереді.
 *
 * ⚠ §R2 дейін мұнда `wall.orientation` ЕСКЕРІЛМЕЙТІН: `wall.finishedLength`
 * әрқашан «биіктік», `wall.position.y/z` әрқашан «ұзындық/қалыңдық осі»
 * деп ҚАТЫРЫЛҒАН еді (ORIENT_FACING деп есептеп). Ол ORIENT_UPRIGHT
 * қабырғада (мыс. минификс режиміндегі цоколь тақтасы) тесікті панельден
 * ТЫС шығаратын — `confirmatJoint`-тегідей, буын осін (`jointAxis`) де,
 * бұранда осін де (`screwAxis`) `orientation`-нан ДИНАМИКАЛЫҚ есептейміз.
 */
export function minifixJoint(wall: Panel, side: Panel, ctx: Ctx): void {
  const wallT = ctx.thickness(wall)
  const sideT = ctx.thickness(side)

  /*
   * Штифт `side`-тың ІШКІ бетінен өтіп, `wall`-дың торціне кіреді —
   * `confirmatJoint`-тегідей рөл: `side` = "face" (бұранда бетінен өтеді),
   * `wall` = "edge" (штифт торціне кіреді).
   */
  const screwAxis = side.orientation.thickness
  /** Буын сызығы — екі панельдің де жазықтығында жатқан ортақ өс. */
  const jointAxis = (['x', 'y', 'z'] as Axis[]).find(
    (a) => a !== screwAxis && a !== wall.orientation.thickness,
  )
  if (!jointAxis) throw new Error(`Буын осі табылмады: ${wall.id} ↔ ${side.id}`)

  const [jointStart, jointEnd] = worldRange(wall, jointAxis, wallT)
  if (jointEnd - jointStart <= MINIFIX_PAIR_SPACING) return
  const jointCentre = (jointStart + jointEnd) / 2
  const rowsWorld = [jointCentre - MINIFIX_PAIR_SPACING / 2, jointCentre + MINIFIX_PAIR_SPACING / 2]

  // wall-дың қай ұшы осы бүйірге тіреледі: жақынырағы (screwAxis бойымен).
  const [wallMin, wallMax] = worldRange(wall, screwAxis, wallT)
  const [sideMin, sideMax] = worldRange(side, screwAxis, sideT)
  const atLeft = Math.abs(wallMin - sideMax) < Math.abs(wallMax - sideMin)

  // side-тың қалыңдығының ортасы — штифт world-та осы деңгейде жатыр.
  const [wallThickMin, wallThickMax] = worldRange(wall, wall.orientation.thickness, wallT)
  const thicknessLineWorld = (wallThickMin + wallThickMax) / 2

  // Ұяның ортасы — торцтан 34 мм ішке қарай (screwAxis бойынша, wall-дың өз өлшемі).
  const wallScrewDim = wall.orientation.length === screwAxis ? wall.finishedLength : wall.finishedWidth
  const camPos = atLeft ? MINIFIX_CAM_FROM_EDGE : wallScrewDim - MINIFIX_CAM_FROM_EDGE

  const edgeFace = edgeFaceFor(wall, screwAxis, atLeft)
  const edgeXShift = edgeXShiftFor(wall, screwAxis, ctx)

  for (const rowWorld of rowsWorld) {
    // wall-дың локал координатасы: jointAxis бойынша — буын сызығындағы орны,
    // screwAxis бойынша — жиектен camPos.
    const alongLocal = wall.orientation.length === jointAxis
      ? localX(wall, rowWorld) : localY(wall, rowWorld)
    const wx = wall.orientation.length === jointAxis ? alongLocal : camPos
    const wy = wall.orientation.width === jointAxis ? alongLocal : camPos

    // 1. Эксцентриктің ұясы — қабырғаның ішкі бетінде.
    pushFace(wall, 'inner', wx, wy, MINIFIX_CAM_DIAMETER, MINIFIX_CAM_DEPTH, 'minifix', ctx)

    // 2. Штифттің тесігі — сол қабырғаның ТОРЦІНДЕ, қалыңдықтың ортасында.
    // Торц бетінің x-і — jointAxis бойынша РАУ локал координата (alongLocal),
    // W1/L1 кромкасы шегеріліп (edgeXShiftFor, §4.9).
    wall.drilling.push({
      face: edgeFace,
      x: roundCoord(alongLocal - edgeXShift),
      y: roundCoord(wallT / 2),
      diameter: MINIFIX_DOWEL_DIAMETER,
      depth: MINIFIX_DOWEL_DEPTH,
      purpose: 'minifix',
    })

    // 3. Штифт бұралатын тесік — бүйірдің ІШКІ бетінде, дәл сол буын
    // сызығында әрі wall-дың қалыңдығының ортасында (confirmatJoint-тегі
    // fx/fy үлгісімен: jointAxis сай осьте rowWorld, қалғанында thicknessLineWorld).
    const sx = side.orientation.length === jointAxis
      ? localX(side, rowWorld) : localX(side, thicknessLineWorld)
    const sy = side.orientation.width === jointAxis
      ? localY(side, rowWorld) : localY(side, thicknessLineWorld)
    pushFace(side, 'inner', sx, sy, MINIFIX_SCREW_DIAMETER, MINIFIX_SCREW_DEPTH, 'minifix', ctx)
  }
}


/**
 * Ящиктің ТҮБІ (16 мм ЛДСП) — бүйірлерге минификспен, алды-артына
 * конфирматпен бекітіледі, әрі алдыңғы жиегінде екі дәлдеу шканты бар.
 *
 * Түп 3 мм ХДФ болғанда бұл буындардың бірде-бірі болмайтын: түп тек
 * қағылатын да, қорап төрт қабырғамен ұсталатын. Түп ЛДСП болғанда ол
 * жүктеме көтереді, ал жүктеме көтеретін буын БҰРҒЫЛАНУЫ керек.
 *
 * `bottom` — ORIENT_HORIZONTAL: локал x — ЕНІ (әлемдік X), локал y —
 * ТЕРЕҢДІГІ (әлемдік Z). Сол себепті W1/W2 — сол/оң торцы, L1 — алдыңғы.
 */
export function drawerBottomJoints(bottom: Panel, sides: Panel[], ctx: Ctx): void {
  const t = ctx.thickness(bottom)
  const width = bottom.finishedLength
  const depth = bottom.finishedWidth

  // Тереңдік бойынша екі стяжка: жиектен MINIFIX_FROM_END шегініп.
  const positions = spreadAlongJoint(depth, 2, MINIFIX_FROM_END)

  for (const side of sides) {
    const sideT = ctx.thickness(side)
    // Штифт side-тың ІШКІ бетінен өтіп, bottom-ның торціне кіреді — жоғарыдағы
    // minifixJoint-тегідей рөл (§R2): screwAxis = side-тың қалыңдық осі.
    const screwAxis = side.orientation.thickness
    const [bottomMin, bottomMax] = worldRange(bottom, screwAxis, t)
    const [sideMin, sideMax] = worldRange(side, screwAxis, sideT)
    const atLeft = Math.abs(bottomMin - sideMax) < Math.abs(bottomMax - sideMin)
    const camX = atLeft ? MINIFIX_CAM_FROM_EDGE : width - MINIFIX_CAM_FROM_EDGE
    const edgeFace = edgeFaceFor(bottom, screwAxis, atLeft)
    const edgeXShift = edgeXShiftFor(bottom, screwAxis, ctx)

    for (const along of positions) {
      // 1. Эксцентриктің ұясы — түптің ҮСТІҢГІ бетінде.
      pushFace(bottom, 'inner', camX, along, MINIFIX_CAM_DIAMETER, MINIFIX_CAM_DEPTH, 'minifix', ctx)

      // 2. Штифттің тесігі — түптің сол/оң ТОРЦІНДЕ.
      bottom.drilling.push({
        face: edgeFace,
        x: roundCoord(along - edgeXShift),
        y: roundCoord(t / 2),
        diameter: MINIFIX_DOWEL_DIAMETER,
        depth: MINIFIX_DOWEL_DEPTH,
        purpose: 'minifix',
      })

      // 3. Бүйірдің ішкі бетінде — штифт бұралатын тесік.
      const worldZ = bottom.position.z + along
      const worldY = bottom.position.y + t / 2
      pushFace(
        side, 'inner',
        localX(side, worldY), localY(side, worldZ),
        MINIFIX_SCREW_DIAMETER, MINIFIX_SCREW_DEPTH, 'minifix', ctx,
      )
    }
  }

  // Алдыңғы жиектегі дәлдеу шканттары.
  // edgeL1 беті — x осы торцтың ұзындығы бойымен (ені, W1↔W2), сол себепті
  // РЕЗ координатасына ауыстыру үшін W1 кромкасы шегеріледі (§4.9,
  // edgeXShiftFor-тегі !alongLength жағдайымен бірдей: face L1/L2 → W1 шегеріледі).
  // Аудит: docs/audit/drilling-2026-09-20.md §O2 — бұл жер 10d97c6-да түзетілмей қалған еді.
  const frontDowelXShift = subtractedThickness(bottom.edges.W1, ctx.bands, ctx.settings)
  for (const x of [DRAWER_BOTTOM_DOWEL_FROM_END, width - DRAWER_BOTTOM_DOWEL_FROM_END]) {
    bottom.drilling.push({
      face: 'edgeL1',
      x: roundCoord(x - frontDowelXShift),
      y: roundCoord(t / 2),
      diameter: DRAWER_BOTTOM_DOWEL_DIAMETER,
      depth: DRAWER_BOTTOM_DOWEL_DEPTH,
      purpose: 'dowel',
    })
  }
}
