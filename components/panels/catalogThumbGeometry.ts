import type { ParsedCabinetInfo } from '@/src/core/data/pro100Catalog'

type Line = { x1: number; y1: number; x2: number; y2: number }

/** Flat isometric shape based only on details explicitly present in the label. */
export function catalogThumbGeometry(parsed: ParsedCabinetInfo): {
  front: { x: number; y: number; width: number; height: number }
  top: string; side: string; frontDividers: Line[]; handles: Line[]
} {
  const x = 10, width = 64
  const height = parsed.position === 'upper' ? 70 : parsed.position === 'lower' ? 86 : 104
  const y = 116 - height
  const dx = 16, dy = 12
  const frontDividers: Line[] = []
  const handles: Line[] = []
  const doors = parsed.doorCount ?? 0
  const drawers = parsed.drawerCount ?? 0
  if (doors > 0) {
    for (let i = 1; i < doors; i++) {
      const lineX = x + width * i / doors
      frontDividers.push({ x1: lineX, y1: y, x2: lineX, y2: y + height })
    }
    for (let i = 0; i < doors; i++) {
      const right = x + width * (i + 1) / doors
      handles.push({ x1: right - 5, y1: y + 8, x2: right - 5, y2: y + 18 })
    }
  } else if (drawers > 0) {
    for (let i = 1; i < drawers; i++) {
      const lineY = y + height * i / drawers
      frontDividers.push({ x1: x, y1: lineY, x2: x + width, y2: lineY })
    }
    for (let i = 0; i < drawers; i++) {
      const lineY = y + height * (i + 0.5) / drawers
      handles.push({ x1: x + 24, y1: lineY, x2: x + 40, y2: lineY })
    }
  }
  return {
    front: { x, y, width, height },
    top: `M${x},${y} L${x + dx},${y - dy} H${x + width + dx} L${x + width},${y} Z`,
    side: `M${x + width},${y} L${x + width + dx},${y - dy} V${y + height - dy} L${x + width},${y + height} Z`,
    frontDividers, handles,
  }
}
