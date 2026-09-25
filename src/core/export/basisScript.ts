/**
 * Базис-Мебельщикке СКРИПТ экспорты: панельдер + присадка (крепеж ретінде).
 *
 * НЕГЕ СКРИПТ. Базис-Раскрой тек детальдер тізімін (Excel) оқиды, ал
 * Базис-Мебельщиктің импорт форматтарында присадка жоқ
 * (`docs/basis/drilling-import-route.md`). Тесікті Базиске жеткізудің
 * ЖАЛҒЫЗ құжатталған жолы — Базистің ресми JavaScript API-і
 * (https://github.com/BazisSoft/Scripts, MIT). Базисте тесік жеке нысан емес:
 * ол КРЕПЕЖ моделінен шығады (конфирмат моделі өзінің Ø7/Ø5 тесігін біледі).
 * Сондықтан біз тесік емес, КРЕПЕЖДІ қоямыз: `Mount(panel1, panel2, x, y, z)`
 * не `Mount1(panel, x, y, z, angle)`.
 *
 * Бұл файл ТАЗА TS (CLAUDE.md §3): ол тек мәтін қайтарады. Скрипттің денесі
 * `basisScriptBody.ts`-те, күмәнді API бөлшектері сол жердегі АДАПТЕР
 * функцияларында оқшауланған (`docs/basis/script-export.md`).
 *
 * КООРДИНАТА. Біздің әлем: X — оңға, Y — жоғары, Z — алдан АРТҚА.
 * Базис: X — оңға, Y — жоғары, Z — АЛҒА (көрерменге қарай). Дәлел: ресми
 * «Aventos HF» үлгісінде арт қабырға z≈16-да, есік z = Depth-те, ал тұтқа
 * `Depth + Thickness`-те (`docs/basis/script-export.md`). Демек бұл айна
 * емес, тек координат ауыстыру: `Z_б = zShift − z`. `zShift` — жобаның ең
 * артқы нүктесі, модель Базисте z ≥ 0 аймағында тұрсын деп.
 *
 * ӨЛШЕМ — ГОТОВЫЙ (basis.ts-тегі ереже). Панель готовый контурмен салынады,
 * ал шегерілетін кромкаға (≥ `minBandSubtract`) `ClipPanel = true` қойылады:
 * сонда Базистің рез өлшемі біздікімен (§4.3) бірдей шығады.
 */
import { HINGE_CUP_DIAMETER, LEG_SCREW_SQUARE, mergeSettings } from '../constants'
import { cutOrigin } from '../drilling'
import { subtractedThickness } from '../edges'
import { panelExtents, rotationFor } from '../geometry'
import type { Pose } from '../tree'
import type {
  Axis, Catalog, ConstructionSettings, Drill, DrillPurpose, EdgeBand, Panel, PanelRole,
  SettingsOverride, Vec3,
} from '../types'
import { BASIS_SCRIPT_BODY } from './basisScriptBody'

// ── Типтер ───────────────────────────────────────────────────────────────────

/** `FlatScene.nodes`-пен құрылымы үйлес: `flattenTree` нәтижесін тікелей береміз. */
export type BasisScriptNode = { nodeId: string; name: string; panels: Panel[]; pose: Pose; settings?: ConstructionSettings | undefined }
export type BasisScriptScene = { nodes: BasisScriptNode[] }

export type BasisVec = [number, number, number]
export type BasisAxis = 'x' | 'y' | 'z'
export type BasisEdgeSide = 'L1' | 'L2' | 'W1' | 'W2'

export type BasisEdgeRecord = {
  side: BasisEdgeSide
  bandId: string
  band: string
  thickness: number
  /** Базис панельді кромка қалыңдығына «подрезает» ме (§4.3 minBandSubtract). */
  clip: boolean
  /** Жақтың ортасы, Базис әлемінде — скрипт контурдың элементін осымен табады. */
  mid: BasisVec
}

export type BasisPanelRecord = {
  panelId: string
  node: number
  name: string
  role: PanelRole
  materialId: string
  material: string
  thickness: number
  /** ГОТОВЫЙ өлшем */
  finishedLength: number
  finishedWidth: number
  /** Салыстыру үшін ғана (Базиске берілмейді): біздің рез өлшеміміз. */
  cutLength: number
  cutWidth: number
  /** Базис әлеміндегі габарит */
  min: BasisVec
  max: BasisVec
  /** Қалыңдық қай әлем осінде */
  normal: BasisAxis
  /** Текстура қай әлем осінде (текстурасыз материалда null) */
  grain: BasisAxis | null
  edges: BasisEdgeRecord[]
  /** Базиске ТОЛЫҚ жетпейтін нәрселер (ойма, паз, фреза) — есепке шығады. */
  notes: string[]
  /** Салынбайтын деталь: себебі. */
  skip: string | null
}

export type BasisHoleRecord = {
  panel: number
  drill: number
  face: Drill['face']
  /** Тесіктің бетке шығатын нүктесі, Базис әлемінде */
  point: BasisVec
  /** Бірлік бағыт: материалдың ІШІНЕ қарай */
  axis: BasisVec
  diameter: number
  depth: number
}

export type BasisFastenerRecord = {
  kind: DrillPurpose
  mount: 'pair' | 'single'
  /** Скрипт крепежді осы түйіннің блогында қояды (панельдерінің ең соңғысы) */
  node: number
  /** pair: [бұранда торцына кіретін деталь, бет деталі]; single: [деталь] */
  panels: number[]
  point: BasisVec
  axis: BasisVec
  holes: BasisHoleRecord[]
  notes: string[]
  skip: string | null
}

export type BasisKindRecord = { id: DrillPurpose; label: string }
export type BasisBandRecord = { id: string; name: string; thickness: number; label: string }

export type BasisScriptData = {
  format: 'furniture-configurator.basis-script'
  version: 1
  project: string
  order: string
  units: 'mm'
  zShift: number
  /** Салыстыру шегі, мм (audit) */
  tolerance: number
  kinds: BasisKindRecord[]
  bands: BasisBandRecord[]
  nodes: { id: string; name: string }[]
  panels: BasisPanelRecord[]
  fasteners: BasisFastenerRecord[]
}

export type BasisScriptOptions = { projectName: string; orderId?: string | undefined }

// ── Тұрақтылар ───────────────────────────────────────────────────────────────

/**
 * Біздің тесік түрлері Базистің қай крепежіне сәйкестендіріледі. Реті
 * ТҰРАҚТЫ: скрипт сәйкестендіруді XML-ге сақтайды, ал жаңа жобаның скрипті
 * сол файлды оқиды — тізім өзгермесе, таңдау қайта сұралмайды.
 */
export const BASIS_FASTENER_KINDS: BasisKindRecord[] = [
  { id: 'confirmat', label: 'Конфирмат (евровинт) [confirmat]' },
  { id: 'minifix', label: 'Минификс [minifix]' },
  { id: 'dowel', label: 'Шкант [dowel]' },
  { id: 'hinge', label: 'Петля: чашка + планка [hinge]' },
  { id: 'shelfPin', label: 'Полкодержатель [shelfPin]' },
  { id: 'handle', label: 'Ручка [handle]' },
  { id: 'runner', label: 'Направляющая ящика [runner]' },
  { id: 'leg', label: 'Опора / ножка [leg]' },
  { id: 'facadeScrew', label: 'Евровинт фасада ящика [facadeScrew]' },
]

/**
 * `bazis.d.ts`-те (2021, классикалық API) ЖОҚ, бірақ скрипт қолданатын атаулар.
 * Әрқайсысының дәлелі — Базистің ресми мысалдар беті
 * (https://cdn.bazissoft.ru/documentation/ru/BAZIS-Script_examples.html):
 *  - «Работа с объектом для сверления отверстий»: fastenerOperations,
 *    NewHoleDrilling, AddBody, AddFasteners, DrillHoles, Bodies, FindBodyInfo,
 *    Holes, Diameter, Depth, Fastener, currentFileData, model;
 *  - «Версия API»: apiVersion.GetScriptApiVersion; «Создание панели»: objects3d;
 *  - ресми «Пакетная обработка/Замена материала.js»: require('fs'), writeFileSync.
 * Бұлар тек AUDIT-та, `typeof` тексерісімен қолданылады: жоқ болса, audit
 * соны жазады, құру тоқтамайды.
 */
export const BASIS_API_FROM_EXAMPLES = [
  'fastenerOperations', 'NewHoleDrilling', 'AddBody', 'AddFasteners', 'DrillHoles', 'Bodies',
  'FindBodyInfo', 'Holes', 'Diameter', 'Depth', 'Fastener', 'currentFileData', 'model',
  'apiVersion', 'GetScriptApiVersion', 'objects3d', 'require', 'writeFileSync',
]

/** Audit салыстыруының шегі, мм. */
export const BASIS_AUDIT_TOLERANCE = 0.5

/**
 * Бір буынның тесіктерін байланыстыру радиусы, мм. Конфирматта бет тесігі
 * мен торц тесігі face панельдің қалыңдығындай (16–25 мм) алыс, минификсте
 * ұя торцтан `MINIFIX_CAM_FROM_EDGE` (34 мм) — 60 мм екеуін де қамтиды, ал
 * көрші буын (≥ 50 мм аралық, ПАРАЛЛЕЛЬ ось) бір түзуге түспейді.
 */
const JOINT_LINK_RADIUS = 60
/** Ось «бір түзуде» деп саналатын қашықтық, мм. */
const COLLINEAR_TOLERANCE = 0.5
/**
 * Ілгектің тесігі (бекіту тесігі, планка) өз чашкасынан алыс емес: планка
 * алдыңғы жиектен 37 мм, биіктігі чашкадан ±16 мм. 100 мм — қор. Тесік ЕҢ
 * ЖАҚЫН чашкаға беріледі, сондықтан екі чашка жақын тұрса да шатаспайды.
 */
const HINGE_LINK_RADIUS = 100
/** Аяқтың төрт бұрандасы шаршы бойында (`LEG_SCREW_SQUARE`), диагоналі < 1.5·a. */
const LEG_LINK_RADIUS = LEG_SCREW_SQUARE * 1.5

// ── Геометрия ────────────────────────────────────────────────────────────────

const AXES: Axis[] = ['x', 'y', 'z']

/** 0.1 мм-ге дөңгелектеу (drilling.ts `roundCoord`-пен бірдей), −0 жоқ. */
const snap = (n: number): number => {
  const r = Math.round(n * 10) / 10
  return r === 0 ? 0 : r
}
/** Бағыт векторы үшін — float шуын кесу. */
const snapDir = (n: number): number => {
  const r = Math.round(n * 1e6) / 1e6
  return r === 0 ? 0 : r
}

/**
 * Тесіктің панельдің КАНОНДЫҚ кеңістігіндегі нүктесі мен бағыты
 * (x — ұзындық, y — ен, z — қалыңдық, ГОТОВЫЙ өлшемде).
 *
 * ⚠ `lib/drillGeometry.ts` `drillToLocalMarker`-дің ДӘЛ КӨШІРМЕСІ: ол `lib/`-те,
 * ал ядро `lib/`-ті импорттамайды (§3). Екеуінің бірдейлігін
 * `tests/basisScript.test.ts` барлық шаблонның барлық тесігінде тексереді.
 */
export function canonicalDrill(
  panel: Panel,
  drill: Drill,
  thickness: number,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): { point: Vec3; direction: Vec3 } {
  const origin = cutOrigin(panel, bands, settings)
  switch (drill.face) {
    case 'inner':
      return { point: { x: drill.x + origin.x, y: drill.y + origin.y, z: thickness }, direction: { x: 0, y: 0, z: -1 } }
    case 'outer':
      return { point: { x: drill.x + origin.x, y: drill.y + origin.y, z: 0 }, direction: { x: 0, y: 0, z: 1 } }
    case 'edgeW1':
      return { point: { x: 0, y: drill.x + origin.y, z: drill.y }, direction: { x: 1, y: 0, z: 0 } }
    case 'edgeW2':
      return { point: { x: panel.finishedLength, y: drill.x + origin.y, z: drill.y }, direction: { x: -1, y: 0, z: 0 } }
    case 'edgeL1':
      return { point: { x: drill.x + origin.x, y: 0, z: drill.y }, direction: { x: 0, y: 1, z: 0 } }
    case 'edgeL2':
      return { point: { x: drill.x + origin.x, y: panel.finishedWidth, z: drill.y }, direction: { x: 0, y: -1, z: 0 } }
    default: {
      const exhaustive: never = drill.face
      throw new Error(`canonicalDrill: белгісіз Drill.face — ${exhaustive as string}`)
    }
  }
}

/** Канондық (ұзындық, ен, қалыңдық) → түйіннің локал кеңістігі (AABB, §4.2). */
function canonicalToNode(panel: Panel, c: Vec3, withOrigin: boolean): Vec3 {
  const out: Vec3 = { x: 0, y: 0, z: 0 }
  const base = withOrigin ? panel.position : { x: 0, y: 0, z: 0 }
  out[panel.orientation.length] = base[panel.orientation.length] + c.x
  out[panel.orientation.width] = base[panel.orientation.width] + c.y
  out[panel.orientation.thickness] = base[panel.orientation.thickness] + c.z
  return out
}

/** `tree.ts` `composePose`-пен бірдей бұрылыс: x' = x·cos + z·sin, z' = −x·sin + z·cos. */
function trig(pose: Pose): { cos: number; sin: number } {
  const a = (pose.rotationY * Math.PI) / 180
  const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Math.abs(n - 1) < 1e-9 ? 1 : Math.abs(n + 1) < 1e-9 ? -1 : n)
  return { cos: clean(Math.cos(a)), sin: clean(Math.sin(a)) }
}

function toWorld(pose: Pose, v: Vec3): Vec3 {
  const { cos, sin } = trig(pose)
  return {
    x: pose.position.x + v.x * cos + v.z * sin,
    y: pose.position.y + v.y,
    z: pose.position.z - v.x * sin + v.z * cos,
  }
}

function dirToWorld(pose: Pose, v: Vec3): Vec3 {
  const { cos, sin } = trig(pose)
  return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos }
}

/** Біздің әлем → Базис әлемі (Z алға қарай). */
const toBasis = (v: Vec3, zShift: number): BasisVec => [snap(v.x), snap(v.y), snap(zShift - v.z)]
const dirToBasis = (v: Vec3): BasisVec => [snapDir(v.x), snapDir(v.y), snapDir(-v.z)]

/** Бірлік бағыттың ең үлкен компоненті қай ос. */
function dominantAxis(v: Vec3): BasisAxis {
  const a = AXES.map((k) => Math.abs(v[k]))
  return AXES[a.indexOf(Math.max(...a))]!
}

const unit = (axis: Axis): Vec3 => ({ x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0, z: axis === 'z' ? 1 : 0 })

/** Панельдің түйін-локал қорабының 8 бұрышы әлемде. */
function worldCorners(panel: Panel, thickness: number, pose: Pose): Vec3[] {
  const e = panelExtents(panel, thickness)
  const out: Vec3[] = []
  for (const dx of [0, e.x]) for (const dy of [0, e.y]) for (const dz of [0, e.z]) {
    out.push(toWorld(pose, { x: panel.position.x + dx, y: panel.position.y + dy, z: panel.position.z + dz }))
  }
  return out
}

// ── Панель жазбасы ───────────────────────────────────────────────────────────

function isTilted(panel: Panel): boolean {
  const base = rotationFor(panel.orientation)
  return panel.rotation.x !== base.x || panel.rotation.y !== base.y || panel.rotation.z !== base.z
}

function panelNotes(panel: Panel): string[] {
  const notes: string[] = []
  if (panel.bevel) notes.push('скос/трапеция не передан — построен прямоугольник заготовки')
  if (panel.cutouts.length > 0) notes.push(`вырезы (${panel.cutouts.length}) не переданы`)
  if (panel.corners && Object.values(panel.corners).some((r) => r > 0)) notes.push('скругления углов не переданы')
  if (panel.milling.length > 0) notes.push('фрезеровка фасада не передана')
  if (panel.grooves.length > 0) notes.push(`пазы (${panel.grooves.length}) не переданы — добавьте в Базисе`)
  return notes
}

type Ctx = {
  catalog: Catalog
  bands: Map<string, EdgeBand>
  settings: ConstructionSettings
}

function thicknessOf(panel: Panel, catalog: Catalog): number {
  const material = catalog.materials.find((m) => m.id === panel.materialId)
  if (!material) throw new Error(`Материал табылмады: ${panel.materialId} (${panel.label})`)
  return material.thickness
}

// ── Негізгі функция: деректер блогы ──────────────────────────────────────────

type HoleRef = BasisHoleRecord & { kind: DrillPurpose; edge: boolean }

export function basisScriptData(
  scene: BasisScriptScene,
  catalog: Catalog,
  settingsOverride?: SettingsOverride,
  options: BasisScriptOptions = { projectName: 'Проект' },
): BasisScriptData {
  const ctx: Ctx = {
    catalog,
    bands: new Map(catalog.edgeBands.map((b) => [b.id, b])),
    settings: mergeSettings(settingsOverride),
  }

  // 1-өту: zShift — салынатын панельдердің ең артқы нүктесі.
  let zMax = Number.NEGATIVE_INFINITY
  for (const node of scene.nodes) {
    if (!rotationSupported(node.pose)) continue
    for (const panel of node.panels) {
      if (isTilted(panel)) continue
      for (const c of worldCorners(panel, thicknessOf(panel, catalog), node.pose)) zMax = Math.max(zMax, c.z)
    }
  }
  const zShift = Number.isFinite(zMax) ? snap(zMax) : 0

  const panels: BasisPanelRecord[] = []
  const fasteners: BasisFastenerRecord[] = []
  const usedBands = new Map<string, BasisBandRecord>()

  // Тесіктер БҮКІЛ сахна бойынша топталады: еркін тақталар — бөлек түйіндер,
  // ал олардың буыны (мыс. қолмен шкант) екі түйінді байланыстырады.
  const holes: HoleRef[] = []
  scene.nodes.forEach((node, nodeIndex) => {
    const nodeCtx = { ...ctx, settings: node.settings ?? ctx.settings }
    for (const panel of node.panels) {
      const index = panels.length
      const rec = panelRecord(panel, nodeIndex, node.pose, zShift, nodeCtx)
      panels.push(rec)
      for (const e of rec.edges) {
        usedBands.set(e.bandId, { id: e.bandId, name: e.band, thickness: e.thickness, label: `${e.band} (${e.thickness} мм) [${e.bandId}]` })
      }
      const t = rec.thickness
      panel.drilling.forEach((drill, drillIndex) => {
        const c = canonicalDrill(panel, drill, t, ctx.bands, nodeCtx.settings)
        const p = toWorld(node.pose, canonicalToNode(panel, c.point, true))
        const d = dirToWorld(node.pose, canonicalToNode(panel, c.direction, false))
        holes.push({
          panel: index, drill: drillIndex, face: drill.face,
          point: toBasis(p, zShift), axis: dirToBasis(d),
          diameter: drill.diameter, depth: drill.depth,
          kind: drill.purpose, edge: drill.face.startsWith('edge'),
        })
      })
    }
  })
  for (const cluster of groupHoles(holes, ctx)) fasteners.push(fastenerRecord(cluster, panels))

  return {
    format: 'furniture-configurator.basis-script',
    version: 1,
    project: options.projectName,
    order: options.orderId ?? options.projectName,
    units: 'mm',
    zShift,
    tolerance: BASIS_AUDIT_TOLERANCE,
    kinds: BASIS_FASTENER_KINDS,
    bands: [...usedBands.values()],
    nodes: scene.nodes.map((n) => ({ id: n.nodeId, name: n.name })),
    panels,
    fasteners,
  }
}

function rotationSupported(pose: Pose): boolean {
  return ((pose.rotationY % 90) + 90) % 90 === 0
}

function panelRecord(panel: Panel, node: number, pose: Pose, zShift: number, ctx: Ctx): BasisPanelRecord {
  const material = ctx.catalog.materials.find((m) => m.id === panel.materialId)
  if (!material) throw new Error(`Материал табылмады: ${panel.materialId} (${panel.label})`)
  const t = material.thickness

  const corners = worldCorners(panel, t, pose).map((c) => toBasis(c, zShift))
  const min: BasisVec = [0, 1, 2].map((k) => Math.min(...corners.map((c) => c[k]!))) as BasisVec
  const max: BasisVec = [0, 1, 2].map((k) => Math.max(...corners.map((c) => c[k]!))) as BasisVec

  const normal = dominantAxis(dirToWorld(pose, unit(panel.orientation.thickness)))
  const grainLocal = panel.grainAlongLength ? panel.orientation.length : panel.orientation.width
  const grain = material.hasGrain ? dominantAxis(dirToWorld(pose, unit(grainLocal))) : null

  const L = panel.finishedLength
  const W = panel.finishedWidth
  const sideMid: Record<BasisEdgeSide, Vec3> = {
    L1: { x: L / 2, y: 0, z: t / 2 },
    L2: { x: L / 2, y: W, z: t / 2 },
    W1: { x: 0, y: W / 2, z: t / 2 },
    W2: { x: L, y: W / 2, z: t / 2 },
  }
  const edges: BasisEdgeRecord[] = []
  for (const side of ['L1', 'L2', 'W1', 'W2'] as const) {
    const spec = panel.edges[side]
    if (!spec) continue
    const band = ctx.bands.get(spec.bandId)
    if (!band) throw new Error(`Кромка табылмады: ${spec.bandId}`)
    edges.push({
      side,
      bandId: band.id,
      band: band.name,
      thickness: band.thickness,
      clip: subtractedThickness(spec, ctx.bands, ctx.settings) > 0,
      mid: toBasis(toWorld(pose, canonicalToNode(panel, sideMid[side], true)), zShift),
    })
  }

  let skip: string | null = null
  if (!rotationSupported(pose)) skip = `поворот ${pose.rotationY}° не кратен 90° — деталь не построена`
  else if (isTilted(panel)) skip = 'наклонная деталь (скос крышки) — не построена, добавьте в Базисе вручную'

  return {
    panelId: panel.id,
    node,
    name: panel.label,
    role: panel.role,
    materialId: material.id,
    material: material.name,
    thickness: t,
    finishedLength: L,
    finishedWidth: W,
    cutLength: panel.cutLength,
    cutWidth: panel.cutWidth,
    min, max, normal, grain, edges,
    notes: panelNotes(panel),
    skip,
  }
}

// ── Тесіктерді крепежге топтау ───────────────────────────────────────────────

const sub = (a: BasisVec, b: BasisVec): BasisVec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: BasisVec, b: BasisVec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: BasisVec, b: BasisVec): BasisVec =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: BasisVec): number => Math.hypot(a[0], a[1], a[2])
const add = (a: BasisVec, b: BasisVec, k: number): BasisVec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

/**
 * Екі тесік бір буынның бөлігі ме: осьтері бір түзуде (параллель) НЕМЕСЕ
 * қиылысады (минификс ұясы мен оның торц тесігі), ал қиылысу нүктесі екі
 * кіре берістен де `JOINT_LINK_RADIUS`-тан алыс емес.
 */
function jointLinked(a: HoleRef, b: HoleRef): boolean {
  // Бір панельдің екі КЕҢ бет тесігі бір буын емес (мыс. екі ұя).
  if (a.panel === b.panel && !a.edge && !b.edge) return false
  const w = sub(b.point, a.point)
  const n = cross(a.axis, b.axis)
  if (len(n) < 1e-6) {
    // Параллель: бір түзуде ме
    return len(cross(w, a.axis)) < COLLINEAR_TOLERANCE && len(w) <= JOINT_LINK_RADIUS
  }
  // Қиылысу: екі түзудің ең жақын нүктелері
  const d = Math.abs(dot(w, n)) / len(n)
  if (d >= COLLINEAR_TOLERANCE) return false
  const aa = dot(a.axis, a.axis)
  const bb = dot(b.axis, b.axis)
  const ab = dot(a.axis, b.axis)
  const denom = aa * bb - ab * ab
  const s = (dot(w, a.axis) * bb - dot(w, b.axis) * ab) / denom
  const c = add(a.point, a.axis, s)
  return len(sub(c, a.point)) <= JOINT_LINK_RADIUS && len(sub(c, b.point)) <= JOINT_LINK_RADIUS
}

function unionClusters(list: HoleRef[], linked: (a: HoleRef, b: HoleRef) => boolean): HoleRef[][] {
  const parent = list.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (linked(list[i]!, list[j]!)) parent[find(j)] = find(i)
    }
  }
  const groups = new Map<number, HoleRef[]>()
  list.forEach((h, i) => {
    const root = find(i)
    const g = groups.get(root) ?? []
    g.push(h)
    groups.set(root, g)
  })
  return [...groups.values()]
}

function byKey(list: HoleRef[], key: (h: HoleRef) => string): HoleRef[][] {
  const groups = new Map<string, HoleRef[]>()
  for (const h of list) {
    const k = key(h)
    const g = groups.get(k) ?? []
    g.push(h)
    groups.set(k, g)
  }
  return [...groups.values()]
}

function cupThreshold(catalog: Catalog): number {
  return Math.min(HINGE_CUP_DIAMETER, ...(catalog.hingeSystems ?? []).map((s) => s.cupDiameter))
}

/** Ілгек: әр чашка — бір крепеж, қалған тесік ЕҢ ЖАҚЫН чашкаға беріледі. */
function hingeClusters(list: HoleRef[], catalog: Catalog): HoleRef[][] {
  const threshold = cupThreshold(catalog)
  const cups = list.filter((h) => h.diameter >= threshold)
  const groups = cups.map((c) => [c])
  const loose: HoleRef[][] = []
  for (const h of list) {
    if (h.diameter >= threshold) continue
    let best = -1
    let bestD = HINGE_LINK_RADIUS
    cups.forEach((c, i) => {
      const d = len(sub(h.point, c.point))
      if (d <= bestD) { bestD = d; best = i }
    })
    if (best >= 0) groups[best]!.push(h)
    else loose.push([h])
  }
  return [...groups, ...loose]
}

function groupHoles(holes: HoleRef[], ctx: Ctx): HoleRef[][] {
  const out: HoleRef[][] = []
  for (const kind of BASIS_FASTENER_KINDS.map((k) => k.id)) {
    const list = holes.filter((h) => h.kind === kind)
    if (list.length === 0) continue
    switch (kind) {
      case 'confirmat':
      case 'minifix':
      case 'dowel':
      case 'facadeScrew':
        out.push(...unionClusters(list, jointLinked))
        break
      case 'hinge':
        out.push(...hingeClusters(list, ctx.catalog))
        break
      case 'handle':
        // Бір фасадта бір тұтқа (`Panel.handle` — жалғыз).
        out.push(...byKey(list, (h) => `${h.panel}`))
        break
      case 'runner':
        // Бір направляющаның бұрандалары бір биіктікте тұрады.
        out.push(...byKey(list, (h) => `${h.panel}:${Math.round(h.point[1])}`))
        break
      case 'leg':
        out.push(...unionClusters(list, (a, b) => a.panel === b.panel && len(sub(a.point, b.point)) <= LEG_LINK_RADIUS))
        break
      case 'shelfPin':
        out.push(...list.map((h) => [h]))
        break
      default: {
        const exhaustive: never = kind
        throw new Error(`groupHoles: белгісіз түр ${exhaustive as string}`)
      }
    }
  }
  // Тұрақты рет: бірінші тесіктің (панель, тесік) нөмірі бойынша.
  return out.sort((a, b) => a[0]!.panel - b[0]!.panel || a[0]!.drill - b[0]!.drill)
}

const unique = (xs: number[]): number[] => [...new Set(xs)]

function centroid(holes: HoleRef[]): BasisVec {
  const s = holes.reduce<BasisVec>((acc, h) => [acc[0] + h.point[0], acc[1] + h.point[1], acc[2] + h.point[2]], [0, 0, 0])
  return [snap(s[0] / holes.length), snap(s[1] / holes.length), snap(s[2] / holes.length)]
}

function fastenerRecord(cluster: HoleRef[], panels: BasisPanelRecord[]): BasisFastenerRecord {
  const kind = cluster[0]!.kind
  const holes: BasisHoleRecord[] = cluster.map(({ kind: _k, edge: _e, ...h }) => h)
  const notes: string[] = []
  let ordered: number[]
  let anchor: HoleRef | null = null
  let pairable = false

  switch (kind) {
    case 'confirmat':
    case 'minifix':
    case 'dowel':
    case 'facadeScrew': {
      pairable = true
      const edgePanels = cluster.filter((h) => h.edge).map((h) => h.panel)
      ordered = unique([...edgePanels, ...cluster.map((h) => h.panel)])
      anchor = cluster.find((h) => h.edge) ?? cluster[0]!
      break
    }
    case 'hinge': {
      pairable = true
      const cup = cluster.reduce((a, b) => (b.diameter > a.diameter ? b : a))
      ordered = unique([...cluster.filter((h) => h.panel !== cup.panel).map((h) => h.panel), cup.panel])
      anchor = cup
      break
    }
    default:
      ordered = unique(cluster.map((h) => h.panel))
      anchor = cluster.length === 1 ? cluster[0]! : null
  }

  const mount: 'pair' | 'single' = pairable && ordered.length >= 2 ? 'pair' : 'single'
  if (ordered.length > 2) {
    notes.push(`соединяет ${ordered.length} детали: ${ordered.map((i) => panels[i]!.name).join(', ')}; в Базис переданы первые две`)
  }
  const used = mount === 'pair' ? ordered.slice(0, 2) : ordered.slice(0, 1)
  const skipped = unique(cluster.map((h) => h.panel)).filter((i) => panels[i]!.skip !== null)
  const skip = skipped.length > 0
    ? `деталь не построена: ${skipped.map((i) => panels[i]!.name).join(', ')}`
    : null

  return {
    kind,
    mount,
    // Скрипт түйіндерді ретімен салады: крепеж өз панельдерінің ЕҢ СОҢҒЫ
    // түйінінде қойылады — сонда екі панель де салынып болған.
    node: Math.max(...cluster.map((h) => panels[h.panel]!.node)),
    panels: used,
    point: anchor ? anchor.point : centroid(cluster),
    axis: (anchor ?? cluster[0]!).axis,
    holes,
    notes,
    skip,
  }
}

// ── Скрипт мәтіні ────────────────────────────────────────────────────────────

/**
 * JSON-ды ASCII-ге: кириллица `\uXXXX` болып жазылады. Базистің ескі нұсқасы
 * файлды CP1251 деп оқыса да, ЖОЛДАР бұзылмайды (тек комментарий бұзылады).
 */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/** Комментарий ішіне қауіпсіз бір жол (жол соңы мен «*\/» жоқ). */
const commentSafe = (s: string): string => s.replace(/[\r\n]+/g, ' ').replace(/\*\//g, '* /')

function header(data: BasisScriptData): string {
  return [
    '// ============================================================================',
    '// Базиске импорт скрипті — furniture-configurator',
    `// Жоба / Проект: ${commentSafe(data.project)}`,
    `// Деталь / Деталей: ${data.panels.length}; крепеж: ${data.fasteners.length}`,
    '//',
    '// ҚАЗАҚША. Бұл файл Базис-Мебельщикте жобаның панельдерін (ГОТОВЫЙ өлшеммен,',
    '// кромкасымен) құрады және присадканы Базистің КРЕПЕЖІ ретінде қояды.',
    '// Орнату: файлды Базистің «Scripts» қалтасына көшіріп, Базисте скрипт ретінде',
    '// іске қосыңыз. Бірінші рет біздің әр крепеж түріне Базистің крепежін бір рет',
    '// таңдайсыз — таңдау скрипттің жанындағы XML файлына сақталады. Соңында',
    '// скрипт өзін тексеріп, «...-bazis-audit.json/.txt» файлын жазады — соны',
    '// бізге жіберіңіз.',
    '//',
    '// ПО-РУССКИ. Скрипт строит в Базис-Мебельщике детали проекта (ГОТОВЫЕ размеры,',
    '// с кромкой) и ставит присадку как КРЕПЁЖ Базиса.',
    '// Установка: скопируйте файл в папку «Scripts» Базиса и запустите как скрипт.',
    '// При первом запуске один раз выберите крепёж Базиса для каждого нашего типа',
    '// (панель «Свойства» справа, затем «Построить») — выбор сохранится в XML рядом',
    '// со скриптом. В конце скрипт сверяет результат и пишет файл',
    '// «...-bazis-audit.json» и «.txt» — отправьте его нам.',
    '// Отверстия без выбранного крепежа НЕ угадываются — они перечислены в отчёте.',
    '// ============================================================================',
  ].join('\n')
}

export function exportBasisScript(
  scene: BasisScriptScene,
  catalog: Catalog,
  settings: SettingsOverride | undefined,
  options: BasisScriptOptions,
): string {
  const data = basisScriptData(scene, catalog, settings, options)
  return [
    header(data),
    `var DATA = ${asciiJson(data)};`,
    `var MSG = ${asciiJson(BASIS_SCRIPT_MESSAGES)};`,
    BASIS_SCRIPT_BODY,
  ].join('\n')
}

/** Файл байттары: UTF-8 + BOM (ресми «Замена материала.js» үлгісі осылай сақталған). */
export function basisScriptBytes(
  scene: BasisScriptScene,
  catalog: Catalog,
  settings: SettingsOverride | undefined,
  options: BasisScriptOptions,
): Uint8Array {
  const body = new TextEncoder().encode(exportBasisScript(scene, catalog, settings, options))
  const out = new Uint8Array(body.length + 3)
  out.set([0xef, 0xbb, 0xbf], 0)
  out.set(body, 3)
  return out
}

/** Скрипттің Базистегі мәтіндері (орысша — цех Базисте орысша жұмыс істейді). */
export const BASIS_SCRIPT_MESSAGES = {
  fastenersGroup: 'Крепёж Базиса для наших типов (выбрать один раз)',
  buttsGroup: 'Кромка Базиса для наших кромок',
  alwaysAsk: 'Всегда показывать сопоставление перед построением',
  writeAudit: 'Писать файл сверки (audit) после построения',
  build: 'Построить',
  firstRun: 'Выберите в панели «Свойства» крепёж Базиса для каждого нашего типа и кромку, затем нажмите «Построить». Выбор сохранится.',
  missing: 'Не выбрано:',
  reportTitle: 'Импорт из конфигуратора — итог',
  panelsBuilt: 'Построено деталей',
  panelsSkipped: 'Не построены (перенесите вручную)',
  fastenersPlaced: 'Установлено крепежа',
  unmapped: 'Крепёж НЕ выбран — отверстия не переданы (не угадываем)',
  holes: 'отв.',
  fastenersSkipped: 'Крепёж пропущен',
  failed: 'Ошибки установки',
  mountNull: 'Mount вернул пустой объект',
  edgeNotChosen: 'Кромка не выбрана',
  edgeNotMatched: 'не найден торец контура для кромки',
  geometry: 'Габарит не совпал с ожидаемым',
  notes: 'Не передано (добавьте вручную)',
  auditSaved: 'Файл сверки сохранён. Отправьте этот файл разработчику:',
  auditFailed: 'Не удалось записать файл сверки',
  auditSummary: 'Сверка',
  ok: 'совпало',
  mismatch: 'расхождений',
  missingItems: 'не найдено',
  extra: 'лишних',
  more: 'и ещё',
}
