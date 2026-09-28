/** Рентгеннің көрнекі геометриясы. Барлық координата мм, өндіріс дерегі өзгермейді. */
import { fittingShape, type FittingVisual } from './fittingGeometry'
import type { Axis, Panel, Vec3 } from '../src/core/types'

type VisualPart = { kind: 'head' | 'shaft' | 'arm' | 'plate' | 'rail'; center: Vec3; size: Vec3 }

function along(point: Vec3, normal: Vec3, distance: number): Vec3 {
  return { x: point.x + normal.x * distance, y: point.y + normal.y * distance, z: point.z + normal.z * distance }
}

function boxPoint(point: Vec3, panel: Panel, thickness: number): Vec3 {
  const output = { x: 0, y: 0, z: 0 }
  output[panel.orientation.length] = point.x - panel.finishedLength / 2
  output[panel.orientation.width] = point.y - panel.finishedWidth / 2
  output[panel.orientation.thickness] = point.z - thickness / 2
  return output
}

function boxDirection(direction: Vec3, panel: Panel): Vec3 {
  const output = { x: 0, y: 0, z: 0 }
  output[panel.orientation.length] = direction.x
  output[panel.orientation.width] = direction.y
  output[panel.orientation.thickness] = direction.z
  return output
}

/** Пішіні ортасынан салынатын box панельге fitting-тің барлық нүктесін көшіреді. */
export function boxFitting(item: FittingVisual, panel: Panel, thickness: number): FittingVisual {
  return {
    ...item,
    point: boxPoint(item.point, panel, thickness),
    normal: boxDirection(item.normal, panel),
    ...(item.rail ? { rail: {
      ...item.rail,
      center: boxPoint(item.rail.center, panel, thickness),
      axis: panel.orientation.width,
    } } : {}),
  }
}

function orientedSize(size: [number, number, number], normal: Vec3): Vec3 {
  const axis = (['x', 'y', 'z'] as const).find((candidate) => normal[candidate] !== 0) ?? 'y'
  const others = (['x', 'y', 'z'] as const).filter((candidate) => candidate !== axis)
  const result = { x: 0, y: 0, z: 0 }
  result[axis] = size[1]
  result[others[0]!] = size[0]
  result[others[1]!] = size[2]
  return result
}

/** Инстанстардың нақты AABB-лері; рендер де осы орталықтарды/өлшемдерді қолданады. */
export function fittingRenderParts(item: FittingVisual): VisualPart[] {
  const shape = fittingShape(item)
  const parts: VisualPart[] = [
    { kind: 'head', center: along(item.point, item.normal, -Math.min(shape.head[1], shape.shaft[1]) / 2), size: orientedSize(shape.head, item.normal) },
    { kind: 'shaft', center: along(item.point, item.normal, -shape.shaft[1] / 2), size: orientedSize(shape.shaft, item.normal) },
  ]
  if (shape.arm) parts.push({ kind: 'arm', center: along(item.point, item.normal, shape.arm[1] / 2), size: orientedSize(shape.arm, item.normal) })
  if (shape.plate && shape.arm) parts.push({ kind: 'plate', center: along(item.point, item.normal, shape.arm[1] + shape.plate[1] / 2), size: orientedSize(shape.plate, item.normal) })
  if (item.rail) {
    const axis: Axis = item.rail.axis ?? 'y'
    const normalAxis = (['x', 'y', 'z'] as const).find((candidate) => item.normal[candidate] !== 0) ?? 'x'
    const size = { x: item.diameter, y: item.diameter, z: item.diameter }
    size[axis] = item.rail.length
    if (normalAxis !== axis) size[normalAxis] = item.rail.sideClearance
    parts.push({ kind: 'rail', center: item.rail.center, size })
  }
  return parts
}

