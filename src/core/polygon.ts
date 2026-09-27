import { ConfigValidationError } from './errors'
import type { EdgeSpec } from './types'

export type PolygonPoint = { x: number; y: number }

/** Нүкте i мен келесі нүкте арасындағы кромка bands[i] арқылы беріледі. */
export type PolygonContourInput = {
  points: PolygonPoint[]
  bands: EdgeSpec[]
}

/** Дайын контур және сол панельдің нақты кесілетін контуры, мм. */
export type PolygonContour = PolygonContourInput & {
  cutPoints: PolygonPoint[]
}

type BandThickness = { thickness: number }

const cross = (a: PolygonPoint, b: PolygonPoint): number => a.x * b.y - a.y * b.x
const sub = (a: PolygonPoint, b: PolygonPoint): PolygonPoint => ({ x: a.x - b.x, y: a.y - b.y })

export function polygonArea(points: readonly PolygonPoint[]): number {
  return Math.abs(points.reduce((sum, p, i) => sum + cross(p, points[(i + 1) % points.length]!), 0)) / 2
}

/** Рез контурындағы бұрғы шеңбері түгел материалда жататынын тексереді. */
export function circleWithinPolygon(points: readonly PolygonPoint[], x: number, y: number, radius: number): boolean {
  if (points.length < 3 || !Number.isFinite(x) || !Number.isFinite(y) ||
    !Number.isFinite(radius) || radius < 0) return false
  let inside = false
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) return false
    const projection = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared))
    const nearX = a.x + projection * dx
    const nearY = a.y + projection * dy
    const distanceSquared = (x - nearX) ** 2 + (y - nearY) ** 2
    if (distanceSquared < radius * radius) return false
    if (distanceSquared === 0) return radius === 0
    if ((a.y > y) !== (b.y > y) && x < a.x + (y - a.y) * dx / dy) inside = !inside
  }
  return inside
}

function signedDoubleArea(points: readonly PolygonPoint[]): number {
  return points.reduce((sum, p, i) => sum + cross(p, points[(i + 1) % points.length]!), 0)
}

function onSegment(a: PolygonPoint, b: PolygonPoint, p: PolygonPoint): boolean {
  return cross(sub(b, a), sub(p, a)) === 0
    && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
    && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
}

function segmentsMeet(a: PolygonPoint, b: PolygonPoint, c: PolygonPoint, d: PolygonPoint): boolean {
  const ab = sub(b, a)
  const cd = sub(d, c)
  const c1 = cross(ab, sub(c, a))
  const c2 = cross(ab, sub(d, a))
  const a1 = cross(cd, sub(a, c))
  const a2 = cross(cd, sub(b, c))
  return (c1 === 0 && onSegment(a, b, c)) || (c2 === 0 && onSegment(a, b, d))
    || (a1 === 0 && onSegment(c, d, a)) || (a2 === 0 && onSegment(c, d, b))
    || ((c1 > 0) !== (c2 > 0) && (a1 > 0) !== (a2 > 0))
}

function validatePoints(points: readonly PolygonPoint[], field: string): void {
  if (points.length < 3) throw new ConfigValidationError(field, 'кемінде үш төбе керек', '≥ 3 төбе')
  for (const [i, point] of points.entries()) {
    if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
      throw new ConfigValidationError(`${field}.points[${i}]`, 'координата бүтін мм болуы тиіс', 'бүтін мм')
    }
    const next = points[(i + 1) % points.length]!
    if (point.x === next.x && point.y === next.y) {
      throw new ConfigValidationError(`${field}.points[${i}]`, 'нөлдік кесінді', 'бөлек төбелер')
    }
  }
  if (signedDoubleArea(points) === 0) throw new ConfigValidationError(field, 'ауданы нөл', 'оң аудан')
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const c = points[(i + 2) % points.length]!
    if (cross(sub(b, a), sub(c, b)) === 0) {
      throw new ConfigValidationError(`${field}.points[${(i + 1) % points.length}]`, 'бір түзудегі артық төбе', 'бұрышты төбе')
    }
    for (let j = i + 1; j < points.length; j += 1) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue
      if (segmentsMeet(a, b, points[j]!, points[(j + 1) % points.length]!)) {
        throw new ConfigValidationError(field, 'контур өзін қияды не жанасады', 'қарапайым полигон')
      }
    }
  }
}

export function validatePolygonContour(
  contour: PolygonContourInput, length: number, width: number, field = 'contour',
): void {
  if (!Number.isSafeInteger(length) || !Number.isSafeInteger(width) || length <= 0 || width <= 0) {
    throw new ConfigValidationError(field, 'дайын габарит қате', 'оң бүтін мм')
  }
  validatePoints(contour.points, field)
  if (contour.bands.length !== contour.points.length) {
    throw new ConfigValidationError(`${field}.bands`, 'әр кесіндіге бір кромка керек', `${contour.points.length} жазба`)
  }
  const xs = contour.points.map((p) => p.x)
  const ys = contour.points.map((p) => p.y)
  if (Math.min(...xs) !== 0 || Math.max(...xs) !== length || Math.min(...ys) !== 0 || Math.max(...ys) !== width) {
    throw new ConfigValidationError(field, 'контур дайын габаритке сәйкес емес', `0..${length} × 0..${width} мм`)
  }
}

/** Қалың кромка әр кесіндіні ішке ығыстырады; 0.4 мм §4.3 бойынша шегерілмейді. */
export function derivePolygonContour(
  contour: PolygonContourInput,
  length: number,
  width: number,
  bands: ReadonlyMap<string, BandThickness>,
  minBandSubtract: number,
  field = 'contour',
): PolygonContour & { cutLength: number; cutWidth: number } {
  validatePolygonContour(contour, length, width, field)
  const points = contour.points
  const ccw = signedDoubleArea(points) > 0
  const lines = points.map((start, i) => {
    const end = points[(i + 1) % points.length]!
    const delta = sub(end, start)
    const size = Math.hypot(delta.x, delta.y)
    const spec = contour.bands[i]
    const band = spec ? bands.get(spec.bandId) : undefined
    if (spec && !band) throw new ConfigValidationError(`${field}.bands[${i}]`, `кромка табылмады: ${spec.bandId}`)
    const inset = band && band.thickness >= minBandSubtract ? band.thickness : 0
    const sign = ccw ? 1 : -1
    const shift = { x: -sign * delta.y * inset / size, y: sign * delta.x * inset / size }
    return { start: { x: start.x + shift.x, y: start.y + shift.y }, delta }
  })
  const raw = lines.map((line, i) => {
    const previous = lines[(i + lines.length - 1) % lines.length]!
    const determinant = cross(previous.delta, line.delta)
    if (determinant === 0) throw new ConfigValidationError(field, 'параллель көрші кесінділер', 'айқын бұрыштар')
    const distance = cross(sub(line.start, previous.start), line.delta) / determinant
    return {
      x: Math.round(previous.start.x + previous.delta.x * distance),
      y: Math.round(previous.start.y + previous.delta.y * distance),
    }
  })
  validatePoints(raw, `${field}.cutPoints`)
  if ((signedDoubleArea(raw) > 0) !== ccw) {
    throw new ConfigValidationError(field, 'кромкадан кейін контур теріс айналды', 'оң өлшемді контур')
  }
  const minX = Math.min(...raw.map((p) => p.x))
  const minY = Math.min(...raw.map((p) => p.y))
  const cutLength = Math.max(...raw.map((p) => p.x)) - minX
  const cutWidth = Math.max(...raw.map((p) => p.y)) - minY
  if (cutLength <= 0 || cutWidth <= 0) throw new ConfigValidationError(field, 'кесілетін габарит нөл', 'оң бүтін мм')
  return { points: contour.points, bands: contour.bands,
    cutPoints: raw.map((p) => ({ x: p.x - minX, y: p.y - minY })), cutLength, cutWidth }
}
