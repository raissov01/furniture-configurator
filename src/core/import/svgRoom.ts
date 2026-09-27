/**
 * SVG-ден еден/бөлме силуэтін импорттау (qdesign-тен қалған функция, 03g §5).
 *
 * Клиент бөлменің жоспарын көбіне DXF емес, SVG болып әкеледі (онлайн
 * жоспарлағыштан, Figma-дан, Inkscape-тен). Мұнда ЖАБЫҚ контурды (polygon,
 * rect, жабық polyline, M/L/H/V/Z жолы) тауып, оны мм-дегі қабырғаларға
 * айналдырамыз. Нәтиженің пішіні DXF импортымен БІРДЕЙ (`DxfImportResult`),
 * сондықтан бар «қабырға алдын ала көрінісі» оны өзгеріссіз қабылдайды.
 *
 * МАСШТАБ — ЕҢ ҚАУІПТІ ЖЕР (DXF-тегі $INSUNITS сияқты). Ретімен:
 *   1. `mmPerUnit` параметрі берілсе — сол (пайдаланушы өзі білдіреді);
 *   2. түбір `<svg>`-де width/height ФИЗИКАЛЫҚ бірлікпен (mm/cm/in/pt/pc) +
 *      viewBox — бір SVG бірлігі = width ÷ viewBox ені;
 *   3. физикалық width бар, viewBox жоқ — SVG бірлігі = CSS пиксель (1/96 дюйм);
 *   4. әйтпесе — ҚАТЕ. Үнсіз болжам бөлмені ондаған есе өзгертіп жіберер еді.
 *
 * Координаттар: SVG x → жоспардың x, SVG y → жоспардың z (DXF-тегі екінші
 * координат сияқты). Барлық өлшем — бүтін мм (CLAUDE.md §0.2).
 *
 * ҚОЛДАУ ЖОҚ (кездессе `skipped`-те саналады, үнсіз жұтылмайды): қисық
 * сызықтар (C/S/Q/T/A), `<use>`, `<circle>`/`<ellipse>`, жабық емес сызықтар.
 * `<defs>`/`<clipPath>`/`<mask>`/`<symbol>`/`<pattern>` ішіндегісі сызылмайды,
 * сондықтан еленбейді.
 */

import { ConfigValidationError } from '../errors'
import { polygonArea, validateSimplePolygon } from '../polygon'
import type { DxfImportResult, DxfPoint, DxfSkippedEntity, DxfWallSegment } from './dxf'

export type SvgRoomImportOptions = {
  /** Бір SVG бірлігі қанша мм. Берілсе, файлдағы бірліктерден басым. */
  mmPerUnit?: number | undefined
  /** Контур ретінде осы `id`-лі элемент алынады. Берілмесе — ең үлкен жабық контур. */
  elementId?: string | undefined
}

export type SvgScaleSource = 'parameter' | 'viewBox' | 'cssPixel'

export type SvgShape = {
  /** Элементтің `id`-і, болмаса `tag[n]`. */
  label: string
  areaMm2: number
}

export type SvgRoomImportResult = DxfImportResult & {
  /** Таңдалған контур, мм (жабық, соңғы нүкте қайталанбайды). */
  outline: DxfPoint[]
  areaMm2: number
  mmPerUnit: number
  scaleSource: SvgScaleSource
  /** Файлдағы барлық жарамды жабық контур — пайдаланушы басқасын таңдай алады. */
  shapes: SvgShape[]
}

/** Файлдың шегі: жоспар бірнеше жүз КБ болады, 5 МБ — артығымен. */
export const SVG_MAX_BYTES = 5 * 1024 * 1024

/** Бір бірліктегі мм. `px` — CSS пиксель (1/96 дюйм). */
const UNIT_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
  px: 25.4 / 96,
}

/** Қабылдау шегі: viewBox пен width/height пропорциясы осыдан артық айырмаса — біркелкі. */
const UNIFORM_SCALE_TOLERANCE = 0.001

// ── Төменгі деңгей: тегтер ──────────────────────────────────────────────────

type Tag = { name: string; closing: boolean; selfClosing: boolean; attrs: Map<string, string> }

const TAG_RE = /<\s*(\/)?\s*([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/)?\s*>/g
const ATTR_RE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function tags(text: string): Tag[] {
  const clean = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  const out: Tag[] = []
  for (const match of clean.matchAll(TAG_RE)) {
    const attrs = new Map<string, string>()
    for (const attr of (match[3] ?? '').matchAll(ATTR_RE)) {
      attrs.set(attr[1]!.replace(/^.*:/, ''), attr[2] ?? attr[3] ?? '')
    }
    out.push({
      name: match[2]!.replace(/^.*:/, '').toLowerCase(),
      closing: match[1] === '/',
      selfClosing: match[4] === '/',
      attrs,
    })
  }
  return out
}

// ── Трансформ ────────────────────────────────────────────────────────────────

/** Аффин матрица [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Matrix = [number, number, number, number, number, number]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

const NUMBER_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g

function numbers(text: string): number[] {
  return [...text.matchAll(NUMBER_RE)].map((m) => Number(m[0]))
}

function parseTransform(text: string, field: string): Matrix {
  let result = IDENTITY
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  const consumed = text.replace(re, '').replace(/[\s,]/g, '')
  if (consumed !== '') {
    throw new ConfigValidationError(field, `түсініксіз transform: «${text.slice(0, 60)}»`, 'matrix/translate/scale/rotate/skewX/skewY')
  }
  for (const match of text.matchAll(re)) {
    const args = numbers(match[2]!)
    const kind = match[1]!
    let m: Matrix
    if (kind === 'matrix' && args.length === 6) m = args as Matrix
    else if (kind === 'translate' && args.length >= 1) m = [1, 0, 0, 1, args[0]!, args[1] ?? 0]
    else if (kind === 'scale' && args.length >= 1) m = [args[0]!, 0, 0, args[1] ?? args[0]!, 0, 0]
    else if (kind === 'rotate' && args.length >= 1) {
      const rad = (args[0]! * Math.PI) / 180
      const [cx, cy] = [args[1] ?? 0, args[2] ?? 0]
      const rotation: Matrix = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0]
      m = multiply(multiply([1, 0, 0, 1, cx, cy], rotation), [1, 0, 0, 1, -cx, -cy])
    } else if (kind === 'skewX' && args.length === 1) m = [1, 0, Math.tan((args[0]! * Math.PI) / 180), 1, 0, 0]
    else if (kind === 'skewY' && args.length === 1) m = [1, Math.tan((args[0]! * Math.PI) / 180), 0, 1, 0, 0]
    else throw new ConfigValidationError(field, `${kind}(${match[2]}) — аргумент саны қате`, 'SVG transform синтаксисі')
    result = multiply(result, m)
  }
  return result
}

const apply = (m: Matrix, p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })

// ── Масштаб ──────────────────────────────────────────────────────────────────

type Length = { value: number; unit: string }

function parseLength(raw: string | undefined): Length | null {
  if (raw === undefined) return null
  const match = /^\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(raw)
  if (!match) return null
  return { value: Number(match[1]), unit: match[2]!.toLowerCase() }
}

const physical = (length: Length | null): length is Length =>
  length !== null && length.unit !== '' && length.unit !== 'px' && length.unit in UNIT_MM

type Scale = { mmPerUnit: number; source: SvgScaleSource; sourceUnits: number; offset: { x: number; y: number } }

/** DXF-тегі $INSUNITS кодтарымен үйлесім үшін (0 — бірліксіз, 1 — дюйм, 4 — мм, 5 — см). */
const INSUNITS_OF: Record<string, number> = { in: 1, mm: 4, cm: 5 }

function resolveScale(root: Tag, options: SvgRoomImportOptions): Scale {
  const viewBoxRaw = root.attrs.get('viewBox')
  const viewBox = viewBoxRaw === undefined ? null : numbers(viewBoxRaw)
  if (viewBox && (viewBox.length !== 4 || viewBox[2]! <= 0 || viewBox[3]! <= 0)) {
    throw new ConfigValidationError('svg.viewBox', `«${viewBoxRaw}» — жарамсыз`, 'min-x min-y ені биіктігі (ені, биіктігі > 0)')
  }
  const offset = viewBox ? { x: viewBox[0]!, y: viewBox[1]! } : { x: 0, y: 0 }

  if (options.mmPerUnit !== undefined) {
    if (!Number.isFinite(options.mmPerUnit) || options.mmPerUnit <= 0) {
      throw new ConfigValidationError('mmPerUnit', `${options.mmPerUnit} — жарамсыз`, '> 0 мм бір SVG бірлігіне')
    }
    return { mmPerUnit: options.mmPerUnit, source: 'parameter', sourceUnits: 0, offset }
  }

  const width = parseLength(root.attrs.get('width'))
  const height = parseLength(root.attrs.get('height'))
  if (physical(width) && width.value > 0) {
    const widthMm = width.value * UNIT_MM[width.unit]!
    if (!viewBox) {
      return { mmPerUnit: UNIT_MM['px']!, source: 'cssPixel', sourceUnits: INSUNITS_OF[width.unit] ?? 0, offset }
    }
    const sx = widthMm / viewBox[2]!
    if (physical(height) && height.value > 0) {
      const sy = (height.value * UNIT_MM[height.unit]!) / viewBox[3]!
      if (Math.abs(sx - sy) / sx > UNIFORM_SCALE_TOLERANCE) {
        throw new ConfigValidationError(
          'svg.viewBox',
          `width/height пропорциясы viewBox-пен сәйкес емес (x ${sx.toFixed(4)}, y ${sy.toFixed(4)} мм/бірлік)`,
          'бірдей масштаб, немесе mmPerUnit параметрі',
        )
      }
    }
    return { mmPerUnit: sx, source: 'viewBox', sourceUnits: INSUNITS_OF[width.unit] ?? 0, offset }
  }

  throw new ConfigValidationError(
    'mmPerUnit',
    'SVG масштабы белгісіз: width/height физикалық бірліксіз (mm/cm/in/pt/pc)',
    '> 0 мм бір SVG бірлігіне (параметр), немесе <svg width="5000mm" viewBox="…">',
  )
}

// ── Пішіндер ─────────────────────────────────────────────────────────────────

type RawPoint = { x: number; y: number }
type RawShape = { label: string; layer: string; points: RawPoint[]; matrix: Matrix }

function pairs(values: number[]): RawPoint[] {
  const out: RawPoint[] = []
  for (let i = 0; i + 1 < values.length; i += 2) out.push({ x: values[i]!, y: values[i + 1]! })
  return out
}

const same = (a: RawPoint, b: RawPoint) => a.x === b.x && a.y === b.y

const PATH_TOKEN_RE = /[MmLlHhVvZzCcSsQqTtAa]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g

/** Жол → жабық ішкі жолдар. Қисық кездессе — `null` (элемент өткізіледі). */
function pathSubpaths(d: string, field: string): RawPoint[][] | null {
  const tokens = [...d.matchAll(PATH_TOKEN_RE)].map((m) => m[0])
  const closed: RawPoint[][] = []
  let current: RawPoint[] = []
  let cursor: RawPoint = { x: 0, y: 0 }
  let start: RawPoint = { x: 0, y: 0 }
  let command = ''
  let i = 0
  const num = (): number => {
    const token = tokens[i]
    if (token === undefined || /[A-Za-z]/.test(token)) {
      throw new ConfigValidationError(field, `«${command}» командасына сан жетпейді`, 'SVG path синтаксисі')
    }
    i += 1
    return Number(token)
  }
  const finish = (isClosed: boolean) => {
    if (current.length > 0 && (isClosed || (current.length > 2 && same(current[0]!, current[current.length - 1]!)))) {
      closed.push(current)
    }
    current = []
  }
  while (i < tokens.length) {
    const token = tokens[i]!
    if (/[A-Za-z]/.test(token)) {
      command = token
      i += 1
      if (/[CcSsQqTtAa]/.test(command)) return null
      if (command === 'Z' || command === 'z') {
        finish(true)
        cursor = start
        continue
      }
    } else if (command === '' ) {
      throw new ConfigValidationError(field, 'жол командасыз басталады', 'M-мен басталатын SVG path')
    } else if (command === 'Z' || command === 'z') {
      throw new ConfigValidationError(field, 'Z-тен кейін сан', 'SVG path синтаксисі')
    }
    const relative = command === command.toLowerCase()
    switch (command.toUpperCase()) {
      case 'M': {
        finish(false)
        const x = num(); const y = num()
        cursor = relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y }
        start = cursor
        current.push(cursor)
        // M-нен кейінгі артық жұптар — L (SVG ережесі).
        command = relative ? 'l' : 'L'
        break
      }
      case 'L': {
        const x = num(); const y = num()
        cursor = relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y }
        current.push(cursor)
        break
      }
      case 'H': {
        const x = num()
        cursor = { x: relative ? cursor.x + x : x, y: cursor.y }
        current.push(cursor)
        break
      }
      case 'V': {
        const y = num()
        cursor = { x: cursor.x, y: relative ? cursor.y + y : y }
        current.push(cursor)
        break
      }
      default:
        throw new ConfigValidationError(field, `белгісіз команда «${command}»`, 'M L H V Z')
    }
  }
  finish(false)
  return closed
}

/** Бүтін мм, қайталанған және бір түзудегі артық төбелерсіз. */
function cleanup(points: DxfPoint[]): DxfPoint[] {
  let out = points.filter((p, i) => i === 0 || p.x !== points[i - 1]!.x || p.z !== points[i - 1]!.z)
  while (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.z === out[out.length - 1]!.z) out = out.slice(0, -1)
  let changed = true
  while (changed && out.length > 3) {
    changed = false
    for (let i = 0; i < out.length; i += 1) {
      const a = out[(i - 1 + out.length) % out.length]!
      const b = out[i]!
      const c = out[(i + 1) % out.length]!
      if ((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x) === 0) {
        out = out.filter((_, j) => j !== i)
        changed = true
        break
      }
    }
  }
  return out
}

const IGNORED_CONTAINERS = new Set(['defs', 'clippath', 'mask', 'symbol', 'pattern', 'marker', 'lineargradient', 'radialgradient'])
const UNSUPPORTED = new Set(['circle', 'ellipse', 'use', 'image', 'text', 'line'])

/**
 * SVG мәтінінен бөлме контурын оқиды. Жарамсыз файл/контур —
 * `ConfigValidationError` өріс атымен.
 */
export function importSvgRoomPlan(text: string, options: SvgRoomImportOptions = {}): SvgRoomImportResult {
  if (text.length > SVG_MAX_BYTES) {
    throw new ConfigValidationError('svg.content', `${text.length} байт`, `≤ ${SVG_MAX_BYTES} байт`)
  }
  const all = tags(text)
  const root = all.find((t) => !t.closing && t.name === 'svg')
  if (!root) throw new ConfigValidationError('svg.content', '<svg> түбір элементі жоқ', 'SVG құжаты')
  const scale = resolveScale(root, options)

  const shapes: RawShape[] = []
  const skipped = new Map<string, number>()
  const skip = (type: string) => skipped.set(type, (skipped.get(type) ?? 0) + 1)
  const counters = new Map<string, number>()
  const stack: { name: string; matrix: Matrix; ignored: boolean }[] = []
  let rootSeen = false

  for (const tag of all) {
    if (tag.closing) {
      // Жабылатын тегке сәйкес ашылғанды тауып, стектен шығарамыз.
      const index = stack.map((s) => s.name).lastIndexOf(tag.name)
      if (index >= 0) stack.length = index
      continue
    }
    const parent = stack[stack.length - 1]
    const count = counters.get(tag.name) ?? 0
    counters.set(tag.name, count + 1)
    const id = tag.attrs.get('id')
    const label = id ? `#${id}` : `${tag.name}[${count}]`
    const field = `svg.${tag.name}${id ? `#${id}` : `[${count}]`}`
    const own = tag.attrs.has('transform') ? parseTransform(tag.attrs.get('transform')!, `${field}.transform`) : IDENTITY
    // Түбір svg-дің өз x/y/transform-ы масштабқа кірмейді: ол viewBox арқылы есептелді.
    const isRoot = tag === root && !rootSeen
    if (isRoot) rootSeen = true
    const matrix = isRoot ? IDENTITY : multiply(parent?.matrix ?? IDENTITY, own)
    const ignored = (parent?.ignored ?? false) || IGNORED_CONTAINERS.has(tag.name)
    if (!tag.selfClosing) stack.push({ name: tag.name, matrix, ignored })
    if (ignored) continue

    const layer = id ?? tag.name
    if (tag.name === 'polygon' || tag.name === 'polyline') {
      const points = pairs(numbers(tag.attrs.get('points') ?? ''))
      const closed = tag.name === 'polygon' || (points.length > 2 && same(points[0]!, points[points.length - 1]!))
      if (!closed) { skip(`${tag.name}:open`); continue }
      shapes.push({ label, layer, points, matrix })
    } else if (tag.name === 'rect') {
      const x = Number(tag.attrs.get('x') ?? 0)
      const y = Number(tag.attrs.get('y') ?? 0)
      const w = Number(tag.attrs.get('width') ?? NaN)
      const h = Number(tag.attrs.get('height') ?? NaN)
      if (!(w > 0) || !(h > 0)) {
        throw new ConfigValidationError(`${field}.width`, `${tag.attrs.get('width')} × ${tag.attrs.get('height')}`, '> 0, SVG бірлігінде')
      }
      shapes.push({ label, layer, points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], matrix })
    } else if (tag.name === 'path') {
      const subpaths = pathSubpaths(tag.attrs.get('d') ?? '', `${field}.d`)
      if (subpaths === null) { skip('path:curve'); continue }
      if (subpaths.length === 0) { skip('path:open'); continue }
      subpaths.forEach((points, index) => shapes.push({
        label: subpaths.length > 1 ? `${label}/${index}` : label, layer, points, matrix,
      }))
    } else if (UNSUPPORTED.has(tag.name)) {
      skip(tag.name)
    }
  }

  const toMm = (shape: RawShape): DxfPoint[] => cleanup(shape.points.map((p) => {
    const q = apply(shape.matrix, p)
    return {
      x: Math.round((q.x - scale.offset.x) * scale.mmPerUnit),
      z: Math.round((q.y - scale.offset.y) * scale.mmPerUnit),
    }
  }))

  const measured = shapes.map((shape) => {
    const outline = toMm(shape)
    const areaMm2 = outline.length >= 3 ? polygonArea(outline.map((p) => ({ x: p.x, y: p.z }))) : 0
    return { shape, outline, areaMm2 }
  })

  let chosen: (typeof measured)[number] | undefined
  if (options.elementId !== undefined) {
    chosen = measured.find((m) => m.shape.label === `#${options.elementId}`)
      ?? measured.find((m) => m.shape.label.startsWith(`#${options.elementId}/`))
    if (!chosen) {
      throw new ConfigValidationError('elementId', `«${options.elementId}» id-лі жабық контур табылмады`,
        measured.map((m) => m.shape.label).join(' | ') || 'жабық контуры бар элемент')
    }
  } else {
    chosen = [...measured].sort((a, b) => b.areaMm2 - a.areaMm2)[0]
  }
  if (!chosen) {
    throw new ConfigValidationError('svg.content', 'жабық контур табылмады', 'polygon, rect, жабық polyline немесе Z-мен жабылған path')
  }

  validateSimplePolygon(chosen.outline.map((p) => ({ x: p.x, y: p.z })), `svg.${chosen.shape.label}`)

  const outline = chosen.outline
  const walls: DxfWallSegment[] = outline.map((start, i) => {
    const end = outline[(i + 1) % outline.length]!
    return { layer: chosen.shape.layer, start, end, length: Math.round(Math.hypot(end.x - start.x, end.z - start.z)) }
  })
  const xs = outline.map((p) => p.x)
  const zs = outline.map((p) => p.z)
  const skippedList: DxfSkippedEntity[] = [...skipped].map(([type, count]) => ({ type, count }))

  return {
    walls,
    circles: [],
    arcs: [],
    layers: [...new Set(shapes.map((s) => s.layer))].sort(),
    bounds: { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) },
    skipped: skippedList,
    sourceUnits: scale.sourceUnits,
    unitsConverted: scale.mmPerUnit !== 1,
    outline,
    areaMm2: chosen.areaMm2,
    mmPerUnit: scale.mmPerUnit,
    scaleSource: scale.source,
    shapes: measured.filter((m) => m.areaMm2 > 0).map((m) => ({ label: m.shape.label, areaMm2: m.areaMm2 })),
  }
}
