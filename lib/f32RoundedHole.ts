import { roundedCutoutPath } from '@/src/core/cutouts'
import { Path } from 'three'

export const roundedHoleSegments = roundedCutoutPath

export function roundedHolePath(bounds: { x: number; y: number; width: number; height: number }, radius: number): Path {
  const { arcs } = roundedHoleSegments(bounds, radius)
  const hole = new Path()
  hole.moveTo(bounds.x + radius, bounds.y)
  hole.lineTo(bounds.x + bounds.width - radius, bounds.y)
  for (let i = 1; i <= arcs.length; i += 1) {
    const arc = arcs[i % arcs.length]!
    if (i > 1) {
      const start = arc.startDeg * Math.PI / 180
      hole.lineTo(arc.center.x + arc.radius * Math.cos(start), arc.center.y + arc.radius * Math.sin(start))
    }
    hole.absarc(arc.center.x, arc.center.y, arc.radius,
      arc.startDeg * Math.PI / 180, arc.endDeg * Math.PI / 180, false)
  }
  hole.closePath()
  return hole
}
