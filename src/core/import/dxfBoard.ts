/** ASCII DXF-тің бір тікбұрышты кесу контуры → өндірістік еркін тақта. */
import { ConfigValidationError } from '../errors'
import { LAYER_CUTOUT, LAYER_GROOVE, LAYER_GROOVE_OUTER, LAYER_MILLING } from '../export/dxf'
import { ORIENT_HORIZONTAL } from '../geometry'
import type { BoardNode } from '../tree'
import { findValue, readDxfDocument, unitFactor } from './dxf'
import type { DxfEntity, RawGroup } from './dxf'

export type DxfBoardOptions = {
  id: string
  name: string
  materialId: string
  /** Берілмесе OUTLINE, әйтпесе жалғыз контур қабаты алынады. */
  layer?: string
}

type Point = { x: number; z: number }
type Segment = { start: Point; end: Point }

function error(message: string, allowed?: string): never {
  throw new ConfigValidationError('dxf.contour', message, allowed)
}

function number(groups: RawGroup[], code: number, field: string): number {
  const raw = findValue(groups, code)
  const value = raw === undefined ? NaN : Number(raw)
  if (!Number.isFinite(value)) error(`${field}: ${code} координатасы жоқ не сан емес`)
  return value
}

function point(groups: RawGroup[], xCode: number, zCode: number, factor: number): Point {
  const x = Math.round(number(groups, xCode, 'X') * factor)
  const z = Math.round(number(groups, zCode, 'Z') * factor)
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) error('координата бүтін мм ауқымынан тыс')
  return { x, z }
}

function equal(a: Point, b: Point): boolean { return a.x === b.x && a.z === b.z }
function key(p: Point): string { return `${p.x},${p.z}` }

function polySegments(points: Point[], closed: boolean): Segment[] {
  if (points.length > 1 && equal(points[0]!, points.at(-1)!)) {
    points = points.slice(0, -1)
    closed = true
  }
  if (!closed) error('контур жабық емес', 'жабық LWPOLYLINE/POLYLINE немесе төрт LINE')
  if (points.length < 3) error('контурда төбе жеткіліксіз')
  return points.map((start, index) => ({ start, end: points[(index + 1) % points.length]! }))
}

function lwVertices(groups: RawGroup[], factor: number): Point[] {
  const result: Point[] = []
  let x: number | undefined
  for (const group of groups) {
    if (group.code === 42 && Number(group.value) !== 0) error('bulge доғасы бар контурды тақтаға айналдыруға болмайды')
    if (group.code === 10) {
      if (x !== undefined) error('LWPOLYLINE төбесінің Z координатасы жоқ')
      x = Number(group.value)
    } else if (group.code === 20 && x !== undefined) {
      const z = Number(group.value)
      if (!Number.isFinite(x) || !Number.isFinite(z)) error('LWPOLYLINE координатасы сан емес')
      const p = { x: Math.round(x * factor), z: Math.round(z * factor) }
      if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.z)) error('координата бүтін мм ауқымынан тыс')
      result.push(p)
      x = undefined
    }
  }
  if (x !== undefined) error('LWPOLYLINE төбесінің Z координатасы жоқ')
  return result
}

function segments(entity: DxfEntity, factor: number): Segment[] {
  if (entity.type === 'LINE') return [{ start: point(entity.groups, 10, 20, factor), end: point(entity.groups, 11, 21, factor) }]
  if (entity.type === 'LWPOLYLINE') {
    return polySegments(lwVertices(entity.groups, factor), (Number(findValue(entity.groups, 70) ?? '0') & 1) !== 0)
  }
  if (entity.type === 'POLYLINE') {
    const points = (entity.vertices ?? []).map((vertex) => point(vertex, 10, 20, factor))
    return polySegments(points, (Number(findValue(entity.groups, 70) ?? '0') & 1) !== 0)
  }
  return error(`${entity.type} контуры өндірістік BoardNode пішініне сыймайды`, 'LINE/LWPOLYLINE/POLYLINE тікбұрышы')
}

/**
 * DXF контуры кесу өлшемі болғандықтан кромкасыз BoardNode жасалады:
 * finished=cut. Кейін кромка таңдалса, §4.3 бойынша cut өлшемі өзгереді.
 */
export function importDxfBoard(text: string, options: DxfBoardOptions): BoardNode {
  for (const field of ['id', 'name', 'materialId'] as const) {
    if (!options[field]?.trim()) throw new ConfigValidationError(`board.${field}`, 'мән бос', 'бос емес мәтін')
  }
  const parsed = readDxfDocument(text)
  if (parsed.insunits === undefined || parsed.insunits === 0) {
    throw new ConfigValidationError('$INSUNITS', 'өндірістік контурдың өлшем бірлігі көрсетілмеген', 'нақты DXF бірлік коды')
  }
  const { factor } = unitFactor(parsed.insunits)
  const unsupportedOperations = new Set([LAYER_CUTOUT, LAYER_GROOVE, LAYER_GROOVE_OUTER, LAYER_MILLING])
  for (const entity of parsed.entities) {
    const operation = findValue(entity.groups, 8)
    if (operation && unsupportedOperations.has(operation)) {
      error(`${operation} операциясы бар; контур импорты оны BoardNode-қа дәл көшірмейді`)
    }
  }
  const drawable = parsed.entities.filter((e) => ['LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE', 'SPLINE'].includes(e.type))
  const layers = [...new Set(drawable.filter((e) => ['LINE', 'LWPOLYLINE', 'POLYLINE'].includes(e.type))
    .map((e) => findValue(e.groups, 8) ?? '0'))]
  const layer = options.layer ?? (layers.includes('OUTLINE') ? 'OUTLINE' : layers.length === 1 ? layers[0] : undefined)
  if (!layer) error('бір контур қабатын анықтау мүмкін емес', 'layer көрсетіңіз немесе жалғыз OUTLINE қабаты')
  const selected = parsed.entities.filter((e) => (findValue(e.groups, 8) ?? '0') === layer)
  for (const entity of selected) {
    if (!['LINE', 'LWPOLYLINE', 'POLYLINE'].includes(entity.type)) {
      error(`${entity.type} нысаны контур қабатында бар; оны BoardNode дәл көрсете алмайды`)
    }
    if (entity.groups.some((g) => [30, 31, 38, 39, 210, 220, 230].includes(g.code) && Number(g.value) !== 0)) {
      error('3D/көтерілген DXF контуры қолдаусыз', 'бір жазықтықтағы 2D контур')
    }
  }
  const contour = selected.filter((e) => ['LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'SPLINE'].includes(e.type))
  if (contour.length === 0) error(`«${layer}» қабатында контур жоқ`)
  const lines = contour.flatMap((entity) => segments(entity, factor))
  if (lines.length !== 4 || lines.some((s) => equal(s.start, s.end))) {
    error('контур бір жабық тікбұрыш емес', 'төрт түзу қабырға')
  }
  const points = lines.flatMap((line) => [line.start, line.end])
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  const minX = Math.min(...xs); const maxX = Math.max(...xs)
  const minZ = Math.min(...zs); const maxZ = Math.max(...zs)
  if (maxX <= minX || maxZ <= minZ) error('контурдың ұзындығы мен ені оң болуы керек')
  const corners = new Set([`${minX},${minZ}`, `${maxX},${minZ}`, `${maxX},${maxZ}`, `${minX},${maxZ}`])
  const degree = new Map<string, number>()
  for (const line of lines) {
    if (!corners.has(key(line.start)) || !corners.has(key(line.end)) ||
      (line.start.x !== line.end.x && line.start.z !== line.end.z)) error('контур тікбұрыш емес')
    for (const p of [line.start, line.end]) degree.set(key(p), (degree.get(key(p)) ?? 0) + 1)
  }
  if (degree.size !== 4 || [...degree.values()].some((count) => count !== 2)) error('контур бір жабық тікбұрыш емес')
  const expectedEdges = new Set([
    [`${minX},${minZ}`, `${maxX},${minZ}`].sort().join('|'),
    [`${maxX},${minZ}`, `${maxX},${maxZ}`].sort().join('|'),
    [`${maxX},${maxZ}`, `${minX},${maxZ}`].sort().join('|'),
    [`${minX},${maxZ}`, `${minX},${minZ}`].sort().join('|'),
  ])
  if (lines.some((line) => !expectedEdges.has([key(line.start), key(line.end)].sort().join('|'))) ||
    new Set(lines.map((line) => [key(line.start), key(line.end)].sort().join('|'))).size !== 4) {
    error('контур бір жабық тікбұрыш емес')
  }
  return {
    kind: 'board', id: options.id, name: options.name,
    transform: { pos: { x: minX, y: 0, z: minZ }, rot: { x: 0, y: 0, z: 0 } },
    board: { materialId: options.materialId, length: maxX - minX, width: maxZ - minZ,
      orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: false,
      edges: { L1: null, L2: null, W1: null, W2: null } },
  }
}
