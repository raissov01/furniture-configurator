/**
 * Базис-Мебельщик модулі (`.b3d`) / фрагменті (`.fr3d`) → түйін ағашы.
 *
 * Формат картасы және әр қорытындының дәлелі: `docs/basis/b3d-format.md`.
 * Контейнер оқу: `basisBz.ts`. Мұнда — мағына:
 *
 *   4002 панель        → BoardNode (өс бойымен тұрса), кромка, контур
 *   3001 тесік жиыны   → тиісті тақтаның Drill-і (присадка)
 *   3001 mesh          → фурнитура тізімі (`hardware`), ұстағыш/аяқ — SolidNode
 *   4001 құрастырма    → ішінде панель болса (техника, металл қорап) — SolidNode
 *
 * Координата: Базисте X — оңға, Y — жоғары, Z — ТЕРЕҢДІКТЕН АЛҒА (фасад
 * Z = D жақта). Бізде Z алдан артқа (types.ts `Axis`), сондықтан z' = D − z.
 * Қолдау жоқ бөлік тасталмайды үнсіз — `warnings`-ке жазылады.
 */
import { ConfigValidationError } from '../errors'
import { DEFAULT_SETTINGS } from '../constants'
import { validateSimplePolygon } from '../polygon'
import type { PolygonPoint } from '../polygon'
import type { BoardNode, GroupNode, SceneNode, SolidNode } from '../tree'
import type { Axis, Drill, DrillPurpose, EdgeSpec, Orientation, PanelEdges, PanelRole } from '../types'
import {
  blob, child, childrenOf, num, readBasisContainer, readContour, str,
} from './basisBz'
import type { BzContourElement, BzNode } from './basisBz'

// ── Жария типтер ─────────────────────────────────────────────────────────────

/** Базистегі `Mat` жолы «Атауы\rАртикул» — екіге бөлінеді. */
export type BasisMaterialRef = { name: string; article: string; thickness: number }
export type BasisBandRef = { name: string; article: string; sign: string }

export type BasisImportOptions = {
  /** Түйін id-лерінің алды. Әдепкі `basis-`. */
  idPrefix?: string
  /** Базис материалы → біздің каталог id. Әдепкі `basis:<артикул>`. */
  materialId?: (material: BasisMaterialRef) => string
  /** Базис кромкасы → біздің EdgeBand id. Әдепкі `basis:<артикул>`. */
  bandId?: (band: BasisBandRef) => string
  /**
   * Кромка қалыңдығы, мм. Базис файлында `Butt.Thick` әрқашан 0 (қалыңдық
   * материал базасында) — әдепкі артикулдан: `K04x19` → 0.4.
   */
  bandThickness?: (band: BasisBandRef) => number | undefined
  /** §4.3: осыдан жұқа кромка рез өлшемінен шегерілмейді. */
  minBandSubtract?: number
}

export type BasisWarningCode =
  | 'no-frame' | 'panel-rotated' | 'panel-bent' | 'panel-not-sheet' | 'panel-size-rounded'
  | 'contour-cutout' | 'contour-simplified' | 'contour-approximated' | 'groove-unsupported'
  | 'hole-purpose-unknown' | 'hole-no-panel' | 'hole-out-of-bounds' | 'hole-rounded' | 'hole-position-rounded'
  | 'object-unsupported' | 'furniture-missing'

export type BasisWarning = { code: BasisWarningCode; message: string; count: number }

export type BasisHardwareItem = { name: string; article: string; furnType: string; count: number }

export type BasisImportInfo = {
  /** 1 — модуль (.b3d), 3 — фрагмент/фурнитура (.fr3d); басқасы — белгісіз */
  fileType: number
  name: string
  code: string
  furnType?: string | undefined
  appVersion?: string | undefined
  /**
   * Delphi TDateTime-тан, уақыт белдеуі ЖОҚ: Базис автордың жергілікті
   * уақытын жазады (файл mtime-мен салыстырғанда UTC+3).
   */
  savedAt?: string | undefined
  /** Габаритная рамка, H × W × D, мм (бүтін) */
  frame: { height: number; width: number; depth: number } | null
  thumbnailPng?: Uint8Array | undefined
}

export type BasisImportStats = {
  panels: number
  boards: number
  contourBoards: number
  skippedPanels: number
  holes: number
  drills: number
  solids: number
  hardwareInstances: number
}

export type BasisImportResult = {
  root: GroupNode
  info: BasisImportInfo
  materials: Array<BasisMaterialRef & { id: string; count: number }>
  bands: Array<BasisBandRef & { id: string; thickness: number | undefined; count: number }>
  hardware: BasisHardwareItem[]
  stats: BasisImportStats
  warnings: BasisWarning[]
}

// ── Кеңістік математикасы ────────────────────────────────────────────────────

type V3 = { x: number; y: number; z: number }
type Quat = { x: number; y: number; z: number; w: number }
type Xform = { p: V3; q: Quat }

/** Бүтін мм; −0-ды 0-ге айналдырады (JSON мен теңдік тексерісі үшін). */
const rnd = (n: number): number => Math.round(n) || 0

const ID: Xform = { p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }
const AXES: Axis[] = ['x', 'y', 'z']

function rotate(q: Quat, v: V3): V3 {
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  }
}

function qmul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

function compose(parent: Xform, local: Xform): Xform {
  const r = rotate(parent.q, local.p)
  return { p: { x: parent.p.x + r.x, y: parent.p.y + r.y, z: parent.p.z + r.z }, q: qmul(parent.q, local.q) }
}

function apply(t: Xform, v: V3): V3 {
  const r = rotate(t.q, v)
  return { x: t.p.x + r.x, y: t.p.y + r.y, z: t.p.z + r.z }
}

function readXform(obj: BzNode): Xform {
  const t = child(obj, 'Trans')
  if (!t) return ID
  return {
    p: { x: num(t, 'X'), y: num(t, 'Y'), z: num(t, 'Z') },
    q: { x: num(t, 'Rx'), y: num(t, 'Ry'), z: num(t, 'Rz'), w: num(t, 'Rw', 1) },
  }
}

/** Бірлік вектор қай әлем өсіне түседі (±). Қиғаш болса — null. */
function axisOf(v: V3): { axis: Axis; sign: 1 | -1 } | null {
  for (const axis of AXES) {
    if (Math.abs(Math.abs(v[axis]) - 1) < 1e-6) return { axis, sign: v[axis] > 0 ? 1 : -1 }
  }
  return null
}

type Box = { min: V3; max: V3 }

function emptyBox(): Box {
  return { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } }
}

function grow(box: Box, p: V3): void {
  for (const a of AXES) {
    box.min[a] = Math.min(box.min[a], p[a])
    box.max[a] = Math.max(box.max[a], p[a])
  }
}

function boxValid(box: Box): boolean {
  return AXES.every((a) => Number.isFinite(box.min[a]) && box.max[a] > box.min[a])
}

// ── Контур → нүктелер ────────────────────────────────────────────────────────

type P2 = { x: number; y: number }
/** Нүктелер тізбегі; `el[i]` — i→i+1 кесіндісі қай Базис элементінен шықты. */
type Loop = { pts: P2[]; el: number[] }

const ARC_STEP = Math.PI / 18 // 10°

function arcPoints(e: Extract<BzContourElement, { kind: 'arc' }>): P2[] {
  const a0 = Math.atan2(e.y1 - e.cy, e.x1 - e.cx)
  const a1 = Math.atan2(e.y2 - e.cy, e.x2 - e.cx)
  const r = Math.hypot(e.x1 - e.cx, e.y1 - e.cy)
  const tau = 2 * Math.PI
  const sweep = e.ccw ? ((a1 - a0) % tau + tau) % tau : -(((a0 - a1) % tau + tau) % tau)
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP))
  const pts: P2[] = [{ x: e.x1, y: e.y1 }]
  for (let i = 1; i < n; i += 1) {
    const a = a0 + (sweep * i) / n
    pts.push({ x: e.cx + r * Math.cos(a), y: e.cy + r * Math.sin(a) })
  }
  pts.push({ x: e.x2, y: e.y2 })
  return pts
}

function elementPoints(e: BzContourElement): P2[] {
  if (e.kind === 'line') return [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]
  if (e.kind === 'arc') return arcPoints(e)
  const n = 36
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: e.cx + e.r * Math.cos((2 * Math.PI * i) / n), y: e.cy + e.r * Math.sin((2 * Math.PI * i) / n),
  }))
}

const near = (a: P2, b: P2): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01

/**
 * Базис элементтерді КЕЗ КЕЛГЕН ретте, кейде кері бағытта жазады
 * (docs §5.2) — ұштарын сәйкестендіріп тұйық ілмектерге жинаймыз.
 */
function chainLoops(elements: BzContourElement[]): Loop[] {
  const segs = elements.map((e, i) => ({ i, pts: elementPoints(e) }))
  const used = new Set<number>()
  const loops: Loop[] = []
  for (const first of segs) {
    if (used.has(first.i)) continue
    used.add(first.i)
    const loop: Loop = { pts: [], el: [] }
    const push = (pts: P2[], i: number): void => {
      for (let k = 0; k < pts.length - 1; k += 1) { loop.pts.push(pts[k]!); loop.el.push(i) }
    }
    push(first.pts, first.i)
    let tail = first.pts.at(-1)!
    const head = first.pts[0]!
    while (!near(tail, head)) {
      const next = segs.find((s) => !used.has(s.i) && (near(s.pts[0]!, tail) || near(s.pts.at(-1)!, tail)))
      if (!next) break
      used.add(next.i)
      const pts = near(next.pts[0]!, tail) ? next.pts : [...next.pts].reverse()
      push(pts, next.i)
      tail = pts.at(-1)!
    }
    if (near(tail, head) && loop.pts.length >= 3) loops.push(loop)
  }
  return loops
}

function area2(pts: readonly P2[]): number {
  return pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]!; return s + p.x * q.y - p.y * q.x }, 0)
}

// ── Атау эвристикасы ─────────────────────────────────────────────────────────

function splitMat(raw: string | undefined): { name: string; article: string } {
  const [name = '', article = ''] = (raw ?? '').split('\r')
  return { name: name.trim(), article: article.trim() }
}

/** `K04x19` → 0.4, `K1x22` → 1, `K2x43` → 2. Танылмаса undefined. */
export function basisBandThicknessFromArticle(article: string): number | undefined {
  const m = /^K(\d+)x\d+/i.exec(article)
  if (!m) return undefined
  const digits = m[1]!
  return digits.startsWith('0') ? Number(digits) / 10 : Number(digits)
}

const ROLE_RULES: Array<[RegExp, PanelRole]> = [
  [/Бок|Боковин/i, 'side'], [/Дно/i, 'bottom'], [/Крыш/i, 'top'], [/Полк/i, 'shelf'],
  [/Стенк|ЛДВП|ХДФ/i, 'back'], [/Двер|Фасад|Фальш|Барн/i, 'front'], [/Цокол/i, 'plinth'],
  [/Планк|Стяжк|Царг/i, 'rail'], [/Средник|Перегород/i, 'divider'],
]

/** `Kind`: 1 — фасад, 2 — столешница, 3 — цоколь; жоқ — корпус детальі (docs §4.3). */
function roleFor(name: string, material: string, kind: number): PanelRole {
  if (kind === 1) return 'front'
  if (kind === 3) return 'plinth'
  for (const [re, role] of ROLE_RULES) if (re.test(name)) return role
  if (/ЛДВП|ХДФ/i.test(material)) return 'back'
  return 'custom'
}

/** Тесік қай фурнитураға арналғаны — ата-блоктың `FurnType`-ынан. */
const PURPOSE_RULES: Array<[RegExp, DrillPurpose]> = [
  [/Евровинт|Конфирмат/i, 'confirmat'], [/Шкант/i, 'dowel'], [/Эксцентрик|Минификс/i, 'minifix'],
  [/Полкодерж/i, 'shelfPin'], [/Петл/i, 'hinge'], [/Ручк/i, 'handle'], [/Опор|Ножк/i, 'leg'],
  [/Направля/i, 'runner'],
]

function purposeFor(furnType: string): DrillPurpose | undefined {
  for (const [re, purpose] of PURPOSE_RULES) if (re.test(furnType)) return purpose
  return undefined
}

/** Көрінетін, 3D-де қорап болып тұратын фурнитура блоктары. */
const SOLID_FURN_TYPES = /^(Ручка|Опора)$/

// ── Негізгі импорт ───────────────────────────────────────────────────────────

type FurnDef = {
  name: string
  min: V3
  max: V3
  holes: Array<{ p: V3; dir: V3; radius: number; depth: number }>
}

type PlacedBoard = {
  node: BoardNode
  box: Box
  thickness: number
  bandW1: number
  bandL1: number
  /** Біздің әлем кадры → тақтаның ата кадры (бұрылған топта айналады). */
  toFrame: (w: V3) => V3
}

type PendingHole = { p: V3; dir: V3; diameter: number; depth: number; furnType: string }

type Bucket = { name: string; box: Box; hasPanel: boolean; group: SceneNode[] }


export function importBasisB3d(bytes: Uint8Array, options: BasisImportOptions = {}): BasisImportResult {
  const { header, document } = readBasisContainer(bytes)
  const prefix = options.idPrefix ?? 'basis-'
  const materialIdOf = options.materialId ?? ((m: BasisMaterialRef) => `basis:${m.article || m.name}`)
  const bandIdOf = options.bandId ?? ((b: BasisBandRef) => `basis:${b.article || b.name}`)
  const bandThicknessOf = options.bandThickness ?? ((b: BasisBandRef) => basisBandThicknessFromArticle(b.article))
  const minBandSubtract = options.minBandSubtract ?? DEFAULT_SETTINGS.minBandSubtract

  const warnings = new Map<string, BasisWarning>()
  const warn = (code: BasisWarningCode, message: string): void => {
    const key = `${code}|${message}`
    const w = warnings.get(key)
    if (w) w.count += 1
    else warnings.set(key, { code, message, count: 1 })
  }

  // ── Тақырып ──
  const article = child(header, 'Article')
  const dt = child(document, 'DateTimeLastSaved')
  const savedAt = dt?.type === 'datetime'
    ? new Date(Date.UTC(1899, 11, 30) + dt.value * 86_400_000).toISOString().slice(0, 19) : undefined
  const model = child(document, 'Model')
  if (!model) throw new ConfigValidationError('basis.b3d', 'құжатта Model жоқ')

  const frameNode = childrenOf(model, 'Obj').find((o) => num(o, 'Type') === 1001)
  const frame = frameNode
    ? { height: rnd(num(frameNode, 'Height')), width: rnd(num(frameNode, 'Width')), depth: rnd(num(frameNode, 'Depth')) }
    : null
  if (!frame) warn('no-frame', 'Габаритная рамка жоқ — терең өсі модельдің өзінен алынады')

  // ── Фурнитура каталогы (FurnList): FastID → габарит пен тесіктер ──
  const furn = new Map<number, FurnDef>()
  for (const entry of childrenOf(child(document, 'FurnList'))) {
    const holes = childrenOf(child(entry, 'Holes'), 'Hole').map((h) => ({
      p: { x: num(h, 'X'), y: num(h, 'Y'), z: num(h, 'Z') },
      dir: { x: num(h, 'DirX'), y: num(h, 'DirY'), z: num(h, 'DirZ') },
      radius: num(h, 'Radius'), depth: num(h, 'Depth'),
    }))
    furn.set(num(entry, 'FastID'), {
      name: str(entry, 'Name') ?? '',
      min: { x: num(entry, 'MinX'), y: num(entry, 'MinY'), z: num(entry, 'MinZ') },
      max: { x: num(entry, 'MaxX'), y: num(entry, 'MaxY'), z: num(entry, 'MaxZ') },
      holes,
    })
  }

  /** Бір панельдің танылмаған контуры бүкіл файлды құлатпауы керек. */
  const safeContour = (bytes: Uint8Array): BzContourElement[] => {
    try {
      return readContour(bytes)
    } catch (e) {
      warn('panel-not-sheet', `контур оқылмады: ${(e as Error).message}`)
      return []
    }
  }

  // Базис → біздің кадр. Рамка болмаса D кейін панельдерден анықталады.
  let depth = frame?.depth ?? NaN
  const toOur = (v: V3): V3 => ({ x: v.x, y: v.y, z: depth - v.z })

  const materials = new Map<string, BasisMaterialRef & { id: string; count: number }>()
  const bands = new Map<string, BasisBandRef & { id: string; thickness: number | undefined; count: number }>()
  const hardware = new Map<string, BasisHardwareItem>()
  const stats: BasisImportStats = {
    panels: 0, boards: 0, contourBoards: 0, skippedPanels: 0, holes: 0, drills: 0, solids: 0, hardwareInstances: 0,
  }
  const placed: PlacedBoard[] = []
  const pendingHoles: PendingHole[] = []
  const buckets: Bucket[] = []
  let seq = 0
  const nextId = (kind: string): string => `${prefix}${kind}${(seq += 1)}`

  const addHardware = (name: string, furnType: string): void => {
    const { name: n, article: a } = splitMat(name)
    const key = `${n}|${a}|${furnType}`
    const item = hardware.get(key)
    if (item) item.count += 1
    else hardware.set(key, { name: n, article: a, furnType, count: 1 })
    stats.hardwareInstances += 1
  }

  // Рамка жоқ фрагментте D = барлық панельдің max Z-і (алдын ала бір айналым).
  if (!frame) {
    const box = emptyBox()
    const scan = (obj: BzNode, parent: Xform): void => {
      const t = compose(parent, readXform(obj))
      if (num(obj, 'Type') === 4002) {
        const c = blob(obj, 'Contour')
        if (c) for (const e of safeContour(c)) for (const p of elementPoints(e)) {
          for (const z of [0, num(obj, 'Thick')]) grow(box, apply(t, { x: p.x, y: p.y, z }))
        }
      }
      for (const o of childrenOf(child(obj, 'Objs'), 'Obj')) scan(o, t)
    }
    for (const o of childrenOf(model, 'Obj')) scan(o, ID)
    depth = Number.isFinite(box.max.z) ? box.max.z : 0
  }

  // ── Панель → BoardNode ──
  const makeBoard = (obj: BzNode, t: Xform): SceneNode | null => {
    const name = str(obj, 'Name') ?? 'Панель'
    const mat = splitMat(str(obj, 'Mat'))
    const thick = num(obj, 'Thick')
    const contourBytes = blob(obj, 'Contour')
    if (!contourBytes || thick <= 0) { warn('panel-not-sheet', `«${name}»: контур не қалыңдық жоқ`); return null }
    // `Bent` жалаушасы нақты иілген панельде де false болып тұрады; белгісі — `BentContour`.
    if (blob(obj, 'BentContour')) { warn('panel-bent', 'иілген панель (BentContour) — жазық тақтаға айналмайды, өткізілді'); return null }
    // Панельдің локал өстері БІЗДІҢ кадрда (z айнасы ескерілген).
    const ourAxis = (v: V3): V3 => { const r = rotate(t.q, v); return { x: r.x, y: r.y, z: -r.z } }
    const locals = [ourAxis({ x: 1, y: 0, z: 0 }), ourAxis({ x: 0, y: 1, z: 0 }), ourAxis({ x: 0, y: 0, z: 1 })]
    // Y осі бойынша бұрылған панель (45° есік, скос бүйір): топқа rot.y беріп,
    // топ ішінде өске түзу қоямыз. composePose: топтың локал X → (cos, 0, −sin).
    let angle = 0
    if (!locals.every((v) => axisOf(v))) {
      if (!locals.some((v) => Math.abs(Math.abs(v.y) - 1) < 1e-6)) {
        warn('panel-rotated', 'көлбеу (Y осінен тыс бұрылған) панель — өткізілді')
        return null
      }
      const u = locals.find((v) => Math.abs(v.y) < 1e-6)!
      angle = Math.atan2(-u.z, u.x)
    }
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    /** Біздің әлем кадры → тақтаның ата-топ кадры. */
    const toFrame = (w: V3): V3 => ({ x: w.x * c - w.z * s, y: w.y, z: w.x * s + w.z * c })
    const [lx, ly, lz] = locals.map((v) => axisOf(toFrame(v))) as Array<ReturnType<typeof axisOf>>
    if (!lx || !ly || !lz) { warn('panel-rotated', 'бұрылған панельдің өстері анықталмады — өткізілді'); return null }

    const elements = safeContour(contourBytes)
    if (elements.length === 0) return null
    if (elements.some((element) => element.kind !== 'line')) {
      warn('contour-approximated', 'доға/шеңбер түзу кесінділермен жуықталды — дәл өндірістік контур сақталмады')
    }
    const loops = chainLoops(elements)
    if (loops.length === 0) { warn('panel-not-sheet', `«${name}»: контур тұйықталмады`); return null }
    const localToOur = (p: P2, z: number): V3 => toFrame(toOur(apply(t, { x: p.x, y: p.y, z })))
    const box = emptyBox()
    for (const loop of loops) for (const p of loop.pts) for (const z of [0, thick]) grow(box, localToOur(p, z))
    // Орын мен өлшем БӨЛЕК дөңгелектенеді: 1.5..298.5 → 297 (ұштарын жеке
    // дөңгелектесек 2..298 = 296 шығып, 1 мм жоғалады).
    const min = { x: rnd(box.min.x), y: rnd(box.min.y), z: rnd(box.min.z) }
    const max = {
      x: min.x + rnd(box.max.x - box.min.x), y: min.y + rnd(box.max.y - box.min.y), z: min.z + rnd(box.max.z - box.min.z),
    }
    if (AXES.some((a) => Math.abs(box.max[a] - box.min[a] - (max[a] - min[a])) > 0.05)) {
      warn('panel-size-rounded', 'бүтін емес өлшем бүтін мм-ге дөңгелектелді (§0.2)')
    }
    const thicknessAxis = lz.axis
    let orientation: Orientation
    if (thicknessAxis === 'x') orientation = { length: 'y', width: 'z', thickness: 'x' }
    else if (thicknessAxis === 'y') orientation = { length: 'x', width: 'z', thickness: 'y' }
    else if (max.y - min.y >= max.x - min.x) orientation = { length: 'y', width: 'x', thickness: 'z' }
    else orientation = { length: 'x', width: 'y', thickness: 'z' }
    const L = orientation.length
    const W = orientation.width
    const length = max[L] - min[L]
    const width = max[W] - min[W]
    if (length <= 0 || width <= 0) { warn('panel-not-sheet', `«${name}»: нөлдік өлшем`); return null }

    // Тақтаның өз локал кадры: x — ұзындық (W1→W2), y — ен (L1→L2).
    const toBoard = (p: P2): P2 => {
      const w = localToOur(p, 0)
      return { x: w[L] - box.min[L], y: w[W] - box.min[W] }
    }
    const butts = childrenOf(child(obj, 'Butts'), 'Butt')
    const bandFor = (elem: number): { spec: EdgeSpec; thickness: number } => {
      const butt = butts.find((b) => num(b, 'Elem', -1) === elem)
      if (!butt) return { spec: null, thickness: 0 }
      const ref: BasisBandRef = { ...splitMat(str(butt, 'Mat')), sign: str(butt, 'Sign') ?? '' }
      const id = bandIdOf(ref)
      const thickness = bandThicknessOf(ref)
      const entry = bands.get(id)
      if (entry) entry.count += 1
      else bands.set(id, { ...ref, id, thickness, count: 1 })
      return { spec: { bandId: id }, thickness: thickness ?? 0 }
    }

    const edges: PanelEdges = { L1: null, L2: null, W1: null, W2: null }
    let contour: { points: PolygonPoint[]; bands: EdgeSpec[] } | undefined
    let bandW1 = 0
    let bandL1 = 0
    const isRect = loops.length === 1 && elements.length === 4 && elements.every((e) => e.kind === 'line')
      && loops[0]!.pts.every((p) => { const b = toBoard(p); return [0, length].some((v) => Math.abs(b.x - v) < 0.5) && [0, width].some((v) => Math.abs(b.y - v) < 0.5) })
    if (isRect) {
      elements.forEach((e, i) => {
        if (e.kind !== 'line') return
        const a = toBoard({ x: e.x1, y: e.y1 })
        const b = toBoard({ x: e.x2, y: e.y2 })
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const side: keyof PanelEdges | null = Math.abs(a.x - b.x) < 0.5
          ? (mx < length / 2 ? 'W1' : 'W2')
          : Math.abs(a.y - b.y) < 0.5 ? (my < width / 2 ? 'L1' : 'L2') : null
        if (!side) return
        const band = bandFor(i)
        edges[side] = band.spec
        if (side === 'W1') bandW1 = band.thickness
        if (side === 'L1') bandL1 = band.thickness
      })
    } else {
      // Ең үлкен ілмек — сыртқы контур; қалғаны ішкі ойық (мойка, розетка).
      const outer = [...loops].sort((a, b) => Math.abs(area2(b.pts)) - Math.abs(area2(a.pts)))[0]!
      if (loops.length > 1) warn('contour-cutout', 'контурдың ішкі ойығы (cutout) импортталмады')
      const pts: PolygonPoint[] = []
      const els: number[] = []
      outer.pts.forEach((p, i) => {
        const b = toBoard(p)
        const q = { x: rnd(b.x), y: rnd(b.y) }
        if (pts.length && pts.at(-1)!.x === q.x && pts.at(-1)!.y === q.y) return
        pts.push(q); els.push(outer.el[i]!)
      })
      if (pts.length > 1 && pts[0]!.x === pts.at(-1)!.x && pts[0]!.y === pts.at(-1)!.y) { pts.pop(); els.pop() }
      // Бір түзудегі артық төбелерді алып тастау (polygon.ts талабы).
      for (let changed = true; changed && pts.length > 3;) {
        changed = false
        for (let i = 0; i < pts.length; i += 1) {
          const a = pts[(i + pts.length - 1) % pts.length]!
          const b = pts[i]!
          const c = pts[(i + 1) % pts.length]!
          if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) === 0) {
            pts.splice(i, 1); els.splice(i, 1); changed = true; break
          }
        }
      }
      try {
        validateSimplePolygon(pts, 'contour')
        const xs = pts.map((p) => p.x)
        const ys = pts.map((p) => p.y)
        if (Math.min(...xs) !== 0 || Math.max(...xs) !== length || Math.min(...ys) !== 0 || Math.max(...ys) !== width) {
          throw new Error('габарит')
        }
        const cache = new Map<number, { spec: EdgeSpec; thickness: number }>()
        const band = (e: number): { spec: EdgeSpec; thickness: number } => {
          if (!cache.has(e)) cache.set(e, bandFor(e))
          return cache.get(e)!
        }
        if (pts.length === 4 && pts.every((p) =>
          (p.x === 0 || p.x === length) && (p.y === 0 || p.y === width))) {
          // Бір қабырғасы бірнеше кесіндіге бөлінген тікбұрыш — қарапайым тақта.
          pts.forEach((a, i) => {
            const b = pts[(i + 1) % 4]!
            const side: keyof PanelEdges = a.x === b.x ? (a.x === 0 ? 'W1' : 'W2') : (a.y === 0 ? 'L1' : 'L2')
            const got = band(els[i]!)
            edges[side] = got.spec
            if (side === 'W1') bandW1 = got.thickness
            if (side === 'L1') bandL1 = got.thickness
          })
        } else {
          contour = { points: pts, bands: els.map((e) => band(e).spec) }
          stats.contourBoards += 1
        }
      } catch {
        warn('contour-simplified', 'қисық контур жарамды полигонға айналмады — габарит тікбұрышы алынды')
      }
    }
    if (childrenOf(child(obj, 'Cuts'), 'Cut').length > 0) {
      warn('groove-unsupported', 'паз (Cuts) оқылды, бірақ BoardSpec-те паз өрісі жоқ — импортталмады')
    }

    const matRef: BasisMaterialRef = { ...mat, thickness: thick }
    const materialId = materialIdOf(matRef)
    const m = materials.get(materialId)
    if (m) m.count += 1
    else materials.set(materialId, { ...matRef, id: materialId, count: 1 })

    // TexDir: 1 — текстура локал X бойымен, 2 — локал Y бойымен (docs §4.4).
    const texDir = num(obj, 'TexDir')
    const grainAxis = texDir === 1 ? lx.axis : texDir === 2 ? ly.axis : undefined

    const node: BoardNode = {
      kind: 'board', id: nextId('b'), name,
      transform: { pos: { ...min }, rot: { x: 0, y: 0, z: 0 } },
      board: {
        materialId, length, width, orientation, edges,
        grainAlongLength: grainAxis === L,
        role: roleFor(name, mat.name, num(obj, 'Kind')),
        ...(contour ? { contour } : {}),
      },
    }
    placed.push({ node, box: { min, max }, thickness: max[orientation.thickness] - min[orientation.thickness], bandW1, bandL1, toFrame })
    if (angle === 0) return node
    return {
      kind: 'group', id: nextId('r'), name,
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: Math.round((angle * 180 / Math.PI) * 1e6) / 1e6, z: 0 } },
      children: [node],
    }
  }

  // ── Ағашты аралау ──
  const rootChildren: SceneNode[] = []

  const walk = (obj: BzNode, parent: Xform, ctx: {
    out: SceneNode[]; depth: number; furnType: string; bucket: Bucket | null; in4001: boolean
  }): void => {
    const type = num(obj, 'Type')
    const t = compose(parent, readXform(obj))
    const name = str(obj, 'Name') ?? ''
    const furnType = str(obj, 'FurnType') ?? ctx.furnType
    if (type === 1001) return // Габаритная рамка / Линия стыка — көмекші сызық
    if (type === 4002) {
      stats.panels += 1
      const mat = str(obj, 'Mat') ?? ''
      if (ctx.in4001 || !mat.includes('\r')) {
        // Техника/металл қораптың денесі — тақта емес, құрастырманың қорабына кіреді.
        if (ctx.bucket) {
          ctx.bucket.hasPanel = true
          const c = blob(obj, 'Contour')
          if (c) for (const e of safeContour(c)) for (const p of elementPoints(e)) {
            for (const z of [0, num(obj, 'Thick')]) grow(ctx.bucket.box, toOur(apply(t, { x: p.x, y: p.y, z })))
          }
        } else warn('panel-not-sheet', 'артикулсыз материал (металл/әйнек) — тақта емес, өткізілді')
        stats.skippedPanels += 1
        return
      }
      const board = makeBoard(obj, t)
      if (board) { ctx.out.push(board); stats.boards += 1 } else stats.skippedPanels += 1
      return
    }
    if (type === 3001) {
      const def = furn.get(num(obj, 'FastID'))
      if (!def) { warn('furniture-missing', 'FastID FurnList-те жоқ'); return }
      if (def.holes.length > 0) {
        for (const h of def.holes) {
          stats.holes += 1
          const p = toOur(apply(t, h.p))
          const d = rotate(t.q, h.dir)
          pendingHoles.push({ p, dir: { x: d.x, y: d.y, z: -d.z }, diameter: 2 * h.radius, depth: h.depth, furnType })
        }
        return
      }
      if (!ctx.in4001) addHardware(name, furnType)
      if (ctx.bucket) {
        for (const x of [def.min.x, def.max.x]) for (const y of [def.min.y, def.max.y]) for (const z of [def.min.z, def.max.z]) {
          grow(ctx.bucket.box, toOur(apply(t, { x, y, z })))
        }
      }
      return
    }
    if (type === 2004 || type === 8100) {
      warn('object-unsupported', `Базис объектісі ${type} (${type === 2004 ? 'профиль' : 'ойық'}) — импортталмады`)
      return
    }
    if (type !== 1005 && type !== 4001 && type !== 1004) {
      warn('object-unsupported', `белгісіз Базис объектісі ${type}`)
      return
    }
    // Блок (1005), құрастырма (4001), 1004 — балаларымен.
    let bucket = ctx.bucket
    let in4001 = ctx.in4001
    if (type === 4001 && !ctx.in4001) {
      addHardware(name, furnType)
      bucket = { name, box: emptyBox(), hasPanel: false, group: ctx.out }
      buckets.push(bucket)
      in4001 = true
    } else if (!bucket && str(obj, 'FurnType') && SOLID_FURN_TYPES.test(str(obj, 'FurnType')!)) {
      bucket = { name: name.split('\r')[0]!, box: emptyBox(), hasPanel: true, group: ctx.out }
      buckets.push(bucket)
    }
    let out = ctx.out
    // Модульдің бірінші деңгейлі бөлімдері (корпус, фасадтар, столешница) — жеке топ.
    if (ctx.depth === 1 && !in4001) {
      const g: GroupNode = { kind: 'group', id: nextId('g'), name: name.split('\r')[0] || furnType || 'Блок', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [] }
      ctx.out.push(g)
      out = g.children
    }
    for (const o of childrenOf(child(obj, 'Objs'), 'Obj')) {
      walk(o, t, { out, depth: ctx.depth + 1, furnType, bucket, in4001 })
    }
  }

  for (const o of childrenOf(model, 'Obj')) {
    walk(o, ID, { out: rootChildren, depth: 0, furnType: str(article, 'FurnType') ?? '', bucket: null, in4001: false })
  }

  // ── Қораптар → SolidNode ──
  for (const b of buckets) {
    if (!b.hasPanel || !boxValid(b.box)) continue
    const min = { x: rnd(b.box.min.x), y: rnd(b.box.min.y), z: rnd(b.box.min.z) }
    const size = { x: rnd(b.box.max.x) - min.x, y: rnd(b.box.max.y) - min.y, z: rnd(b.box.max.z) - min.z }
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) continue
    const solid: SolidNode = {
      kind: 'solid', id: nextId('s'), name: b.name,
      transform: { pos: min, rot: { x: 0, y: 0, z: 0 } }, solid: { size },
    }
    b.group.push(solid)
    stats.solids += 1
  }

  // ── Тесіктер → Drill ──
  const EPS = 0.6
  for (const h of pendingHoles) {
    const purpose = purposeFor(h.furnType)
    if (!purpose) { warn('hole-purpose-unknown', `«${h.furnType || '—'}» тесігінің мақсаты белгісіз — өткізілді`); continue }
    let attached = false
    for (const pb of placed) {
      const { box, thickness } = pb
      const hp = pb.toFrame(h.p)
      const hd = pb.toFrame(h.dir)
      const o = pb.node.board.orientation
      const inside = (axis: Axis): boolean => hp[axis] > box.min[axis] - EPS && hp[axis] < box.max[axis] + EPS
      let face: Drill['face'] | null = null
      for (const [axis, lo, hi] of [
        [o.thickness, 'outer', 'inner'], [o.length, 'edgeW1', 'edgeW2'], [o.width, 'edgeL1', 'edgeL2'],
      ] as Array<[Axis, Drill['face'], Drill['face']]>) {
        const others = AXES.filter((a) => a !== axis)
        if (!others.every(inside)) continue
        if (Math.abs(hp[axis] - box.min[axis]) < EPS && hd[axis] > 0.99) face = lo
        else if (Math.abs(hp[axis] - box.max[axis]) < EPS && hd[axis] < -0.99) face = hi
        if (face) break
      }
      if (!face) continue
      attached = true
      const along = (axis: Axis): number => hp[axis] - box.min[axis]
      const isFace = face === 'inner' || face === 'outer'
      const onW = face === 'edgeW1' || face === 'edgeW2'
      const cut = (v: number, band: number): number => v - (band >= minBandSubtract ? band : 0)
      const xRaw = isFace ? cut(along(o.length), pb.bandW1) : onW ? cut(along(o.width), pb.bandL1) : cut(along(o.length), pb.bandW1)
      const x = rnd(xRaw)
      const yRaw = isFace ? cut(along(o.width), pb.bandL1) : along(o.thickness)
      const y = !isFace && Math.abs(yRaw - thickness / 2) < EPS ? thickness / 2 : rnd(yRaw)
      if (!isFace && y !== thickness / 2) {
        // validateJointDrill: торц тесігі тек қалыңдық ортасында.
        warn('hole-out-of-bounds', 'торц тесігі қалыңдық ортасында емес — өткізілді')
        break
      }
      if (Math.abs(xRaw - x) > 1e-6 || Math.abs(yRaw - y) > 1e-6) {
        warn('hole-position-rounded', 'тесік координаты бүтін мм-ге дөңгелектелді')
      }
      const b = pb.node.board
      const limit = isFace ? thickness : onW ? b.length : b.width
      // Hardware drawing sizes retain 0.1 mm precision (CLAUDE.md §0.2).
      const rawDepth = Math.min(h.depth, limit)
      const depthMm = Math.round(rawDepth * 10) / 10
      const diameterMm = Math.round(h.diameter * 10) / 10
      if (Math.abs(h.diameter - diameterMm) > 1e-6 || Math.abs(rawDepth - depthMm) > 1e-6) {
        warn('hole-rounded', 'тесік Ø/тереңдігі 0.1 мм-ге дөңгелектелді')
      }
      const drill: Drill = { face, x, y, diameter: diameterMm, depth: depthMm, purpose }
      const r = drill.diameter / 2
      const alongMax = isFace ? b.length : onW ? b.width : b.length
      const acrossMax = isFace ? b.width : thickness
      if (x < r || x > alongMax - r || y < r || y > acrossMax - r) {
        warn('hole-out-of-bounds', 'тесік тақта шегінен шықты — өткізілді')
        break
      }
      b.drilling ??= []
      if (!b.drilling.some((d) => d.face === drill.face && d.x === drill.x && d.y === drill.y && d.diameter === drill.diameter)) {
        b.drilling.push(drill)
        stats.drills += 1
      }
      break
    }
    if (!attached) warn('hole-no-panel', 'тесік ешбір тақтаның бетіне/жиегіне түспеді — өткізілді')
  }

  const root: GroupNode = {
    kind: 'group', id: `${prefix}root`, name: str(article, 'Name') ?? 'Базис модулі',
    transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    children: rootChildren,
  }
  // Бос бөлімдерді (тек фурнитура болған) алып тастаймыз.
  const prune = (g: GroupNode): void => {
    g.children = g.children.filter((c) => c.kind !== 'group' || (prune(c), c.children.length > 0))
  }
  prune(root)

  // Warnings stay with the imported model, not just the transient import dialog.
  // There is no acknowledged-loss override: rebuild unsupported geometry from
  // its source before this model is eligible for manufacturing.
  const losses = [...warnings.values()].filter((warning) => warning.code !== 'no-frame')
  if (losses.length > 0) {
    const reason = `Базис: неполный импорт. Экспорт для производства заблокирован. ${losses.map((w) => `${w.code}: ${w.message} (${w.count})`).join('; ')}. Восстановите операции по исходному файлу.`
    for (const { node } of placed) node.board.manufacturingBlockReason = reason
  }

  const thumb = blob(header, 'Thumbnail')
  return {
    root,
    info: {
      fileType: num(article, 'FileType'),
      name: str(article, 'Name') ?? '',
      code: str(article, 'Code') ?? '',
      furnType: str(article, 'FurnType'),
      appVersion: str(document, 'AppVersion'),
      savedAt,
      frame,
      thumbnailPng: thumb && thumb[0] === 0x89 && thumb[1] === 0x50 ? thumb : undefined,
    },
    materials: [...materials.values()],
    bands: [...bands.values()],
    hardware: [...hardware.values()].sort((a, b) => b.count - a.count),
    stats,
    warnings: [...warnings.values()],
  }
}
