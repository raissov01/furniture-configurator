import type { PolygonPoint } from '@/src/core/polygon'
import { Shape } from 'three'

/** Көріністің сыртқы жиегі дайын панель координатасымен салынады. */
export function panelOutlinePoints(
  contour: { points: PolygonPoint[] } | undefined, length: number, width: number,
): PolygonPoint[] {
  return contour?.points ?? [
    { x: 0, y: 0 }, { x: length, y: 0 }, { x: length, y: width }, { x: 0, y: width },
  ]
}

export function polygonShape(contour: { points: PolygonPoint[] }, length: number, width: number): Shape {
  const shape = new Shape()
  const [first, ...rest] = panelOutlinePoints(contour, length, width)
  if (!first) return shape
  shape.moveTo(first.x, first.y)
  for (const point of rest) shape.lineTo(point.x, point.y)
  shape.closePath()
  return shape
}
