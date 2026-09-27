/** Бүтін мм AABB орындарына тәуелсіз әр өс бойынша привязка. */
import { ConfigValidationError } from './errors'
import type { Axis, Room, Vec3 } from './types'

export type SnapHint = { axis: Axis; kind: 'face' | 'edge' | 'centre' | 'grid' | 'wall'; at: number; targetId?: string }
export type SnapBox = { pos: Vec3; size: Vec3 }
export type SnapTarget = SnapBox & { id: string }
export type SnapOptions = { grid: number; tolerance: number }
export type SnapFootprint = { id: string; corners: readonly { x: number; z: number }[]; minY: number; maxY: number }
const axes: readonly Axis[] = ['x', 'y', 'z']
const priority: Record<SnapHint['kind'], number> = { face: 0, wall: 1, edge: 2, centre: 3, grid: 4 }

function integer(value: number, path: string, positive = false): void {
  if (!Number.isSafeInteger(value) || (positive && value <= 0)) {
    throw new ConfigValidationError(path, 'қауіпсіз бүтін мм керек', positive ? '> 0 бүтін мм' : 'бүтін мм')
  }
}

function validate(box: SnapBox, path: string): void {
  for (const axis of axes) {
    integer(box.pos[axis], `${path}.pos.${axis}`)
    integer(box.size[axis], `${path}.size.${axis}`, true)
    integer(box.pos[axis] + box.size[axis], `${path}.max.${axis}`)
  }
}

/** Ең жақын нүкте ұтады; тең болса физикалық бет/қабырға, одан кейін жиек/центр/тор. */
export function snapPosition(moving: SnapBox, others: readonly SnapTarget[], room: Pick<Room, 'width' | 'height' | 'depth'>,
  opts: SnapOptions): { pos: Vec3; hints: SnapHint[] } {
  validate(moving, 'moving')
  integer(opts.grid, 'grid')
  integer(opts.tolerance, 'tolerance')
  if (opts.grid < 0) throw new ConfigValidationError('grid', 'теріс тор қадамы', '≥ 0 мм')
  if (opts.tolerance < 0) throw new ConfigValidationError('tolerance', 'теріс шек', '≥ 0 мм')
  for (const [i, other] of others.entries()) {
    validate(other, `others[${i}]`)
    if (!other.id.trim()) throw new ConfigValidationError(`others[${i}].id`, 'бос id', 'бос емес id')
  }
  for (const axis of axes) integer(axis === 'x' ? room.width : axis === 'y' ? room.height : room.depth, `room.${axis}`, true)
  const pos = { ...moving.pos }
  const hints: SnapHint[] = []
  for (const axis of axes) {
    const start = moving.pos[axis]
    const end = start + moving.size[axis]
    const candidates: { delta: number; hint: SnapHint }[] = []
    const add = (delta: number, kind: SnapHint['kind'], at: number, targetId?: string) => {
      if (Number.isSafeInteger(delta) && Math.abs(delta) <= opts.tolerance) {
        candidates.push({ delta, hint: { axis, kind, at, ...(targetId ? { targetId } : {}) } })
      }
    }
    for (const other of others) {
      const lo = other.pos[axis]
      const hi = lo + other.size[axis]
      add(lo - end, 'face', lo, other.id)
      add(hi - start, 'face', hi, other.id)
      add(lo - start, 'edge', lo, other.id)
      add(hi - end, 'edge', hi, other.id)
      const twiceDelta = lo + hi - start - end
      if (twiceDelta % 2 === 0) add(twiceDelta / 2, 'centre', (lo + hi) / 2, other.id)
    }
    const roomSize = axis === 'x' ? room.width : axis === 'y' ? room.height : room.depth
    add(-start, 'wall', 0)
    add(roomSize - end, 'wall', roomSize)
    if (opts.grid > 0) {
      const gridAt = Math.round(start / opts.grid) * opts.grid
      add(gridAt - start, 'grid', gridAt)
    }
    candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || priority[a.hint.kind] - priority[b.hint.kind])
    const best = candidates[0]
    if (best) {
      pos[axis] += best.delta
      hints.push(best.hint)
    }
  }
  return { pos, hints }
}

/**
 * Айналған екі тіктөртбұрыштың нақты XZ жиектерін беттестіру. Координата
 * бүтін мм болу үшін нормаль бойындағы жылжу жақын бүтін X/Z-ке дөңгелектенеді;
 * қалдық қате ең көбі жарты мм әр өс бойынша. Жиектер параллель әрі биіктігі
 * қабаттасқанда ғана кандидат саналады. Бұл AABB бұрышына snap емес.
 */
export function snapRotatedEdges(moving: SnapFootprint, others: readonly SnapFootprint[], tolerance: number):
  { delta: { x: number; z: number }; targetId: string } | null {
  if (!Number.isSafeInteger(tolerance) || tolerance < 0) throw new ConfigValidationError('tolerance', 'теріс не бөлшек шек', '≥ 0 бүтін мм')
  const edge = (corners: SnapFootprint['corners'], index: number) => [corners[index]!, corners[(index + 1) % corners.length]!] as const
  let best: { delta: { x: number; z: number }; targetId: string; score: number } | null = null
  if (moving.corners.length !== 4) throw new ConfigValidationError('moving.corners', 'төрт бұрыш керек', '4 бұрыш')
  for (const other of others) {
    if (other.corners.length !== 4) throw new ConfigValidationError(`others.${other.id}.corners`, 'төрт бұрыш керек', '4 бұрыш')
    if (moving.maxY <= other.minY || other.maxY <= moving.minY) continue
    for (let i = 0; i < 4; i += 1) {
      const [ma, mb] = edge(moving.corners, i)
      const mdx = mb.x - ma.x; const mdz = mb.z - ma.z
      const mLength = Math.hypot(mdx, mdz)
      if (mLength < 1e-9) continue
      for (let j = 0; j < 4; j += 1) {
        const [ta, tb] = edge(other.corners, j)
        const tdx = tb.x - ta.x; const tdz = tb.z - ta.z
        const length = Math.hypot(tdx, tdz)
        if (length < 1e-9 || Math.abs((mdx * tdz - mdz * tdx) / (mLength * length)) > 1e-6) continue
        const ux = tdx / length; const uz = tdz / length
        const along = (point: { x: number; z: number }) => (point.x - ta.x) * ux + (point.z - ta.z) * uz
        if (Math.min(along(ma), along(mb)) >= length || Math.max(along(ma), along(mb)) <= 0) continue
        const nx = -uz; const nz = ux
        const distance = (ma.x - ta.x) * nx + (ma.z - ta.z) * nz
        if (Math.abs(distance) > tolerance) continue
        const delta = { x: Math.round(-distance * nx), z: Math.round(-distance * nz) }
        if (delta.x === 0 && delta.z === 0) continue
        const residual = Math.abs(distance + delta.x * nx + delta.z * nz)
        if (residual > Math.SQRT1_2) continue
        const score = Math.abs(distance) + residual * 0.001
        if (!best || score < best.score) best = { delta, targetId: other.id, score }
      }
    }
  }
  return best ? { delta: best.delta, targetId: best.targetId } : null
}
