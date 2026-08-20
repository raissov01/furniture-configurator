/**
 * Сызбаның таза геометриясы: панельдерді жазықтыққа проекциялау.
 * PDF те, SVG те осыны қолданады — сызу кітапханасы бұл жерге кірмейді.
 */

import { panelExtents } from '../geometry'
import type { Axis, Panel, Vec3 } from '../types'

export type Rect = { x: number; y: number; w: number; h: number; panelId: string; role: string }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
export type Polygon = { points: [number, number][]; shade: number; panelId: string }

/** Фас (X-Y), бүйір (Z-Y), жоспар (X-Z). */
export type ElevationView = 'front' | 'side' | 'plan'

const AXES: Record<ElevationView, { h: Axis; v: Axis; flipV: boolean }> = {
  // PDF-те Y жоғары қарайды, ал біздің Y де жоғары — аудару керек емес.
  front: { h: 'x', v: 'y', flipV: false },
  side: { h: 'z', v: 'y', flipV: false },
  // Жоспарда тереңдік төмен қарай өссін: қағазда алдыңғы жақ астында тұрады.
  plan: { h: 'x', v: 'z', flipV: true },
}

export function projectElevation(
  panels: Panel[],
  thicknessOf: (p: Panel) => number,
  view: ElevationView,
): { rects: Rect[]; bounds: Bounds } {
  const { h, v, flipV } = AXES[view]
  const rects: Rect[] = []
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  for (const panel of panels) {
    const e = panelExtents(panel, thicknessOf(panel))
    const x = panel.position[h]
    const y = flipV ? -(panel.position[v] + e[v]) : panel.position[v]
    const rect: Rect = { x, y, w: e[h], h: e[v], panelId: panel.id, role: panel.role }
    rects.push(rect)
    bounds.minX = Math.min(bounds.minX, rect.x)
    bounds.minY = Math.min(bounds.minY, rect.y)
    bounds.maxX = Math.max(bounds.maxX, rect.x + rect.w)
    bounds.maxY = Math.max(bounds.maxY, rect.y + rect.h)
  }
  return { rects, bounds }
}

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = 0.5

/**
 * Изометрия. Көрермен алдыңғы-жоғарғы-оң жақта тұрады, сондықтан тереңдік
 * өсі аударылады: алдыңғы бет (z = 0) көрерменге ең жақын.
 */
export function isoPoint(x: number, y: number, z: number, depth: number): [number, number] {
  const zv = depth - z
  return [(x - zv) * COS30, y + (x + zv) * SIN30]
}

/**
 * Ажыратылған изометрия. Әр панель ӨЗ ҚАЛЫҢДЫҚ өсі бойымен ортадан жылжиды —
 * 3D көріністегі ереженің дәл өзі.
 */
export function projectIsometric(
  panels: Panel[],
  thicknessOf: (p: Panel) => number,
  cabinet: { width: number; height: number; depth: number },
  explode = 0,
): { polygons: Polygon[]; bounds: Bounds } {
  const centre: Vec3 = { x: cabinet.width / 2, y: cabinet.height / 2, z: cabinet.depth / 2 }
  const polygons: Polygon[] = []
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  type Box = { min: Vec3; max: Vec3; panelId: string; key: number }
  const boxes: Box[] = panels.map((panel) => {
    const e = panelExtents(panel, thicknessOf(panel))
    const min = { ...panel.position }
    if (explode > 0) {
      const axis = panel.orientation.thickness
      const c = min[axis] + e[axis] / 2
      const dir = c === centre[axis] ? 1 : Math.sign(c - centre[axis])
      min[axis] += dir * explode
    }
    const max = { x: min.x + e.x, y: min.y + e.y, z: min.z + e.z }
    // Суретшінің алгоритмі: көрерменнен алыстағысы бірінші салынады.
    const key = (min.x + max.x) / 2 + (min.y + max.y) / 2 + (cabinet.depth - (min.z + max.z) / 2)
    return { min, max, panelId: panel.id, key }
  })

  boxes.sort((a, b) => a.key - b.key)

  for (const box of boxes) {
    const { min, max } = box
    const P = (x: number, y: number, z: number) => isoPoint(x, y, z, cabinet.depth)
    // Көрінетін үш бет: оң (+x), үст (+y), алдыңғы (z ең кіші)
    const faces: [Array<[number, number]>, number][] = [
      [[P(max.x, min.y, min.z), P(max.x, max.y, min.z), P(max.x, max.y, max.z), P(max.x, min.y, max.z)], 0.72],
      [[P(min.x, max.y, min.z), P(max.x, max.y, min.z), P(max.x, max.y, max.z), P(min.x, max.y, max.z)], 0.92],
      [[P(min.x, min.y, min.z), P(max.x, min.y, min.z), P(max.x, max.y, min.z), P(min.x, max.y, min.z)], 0.82],
    ]
    for (const [points, shade] of faces) {
      polygons.push({ points, shade, panelId: box.panelId })
      for (const [px, py] of points) {
        bounds.minX = Math.min(bounds.minX, px)
        bounds.minY = Math.min(bounds.minY, py)
        bounds.maxX = Math.max(bounds.maxX, px)
        bounds.maxY = Math.max(bounds.maxY, py)
      }
    }
  }
  return { polygons, bounds }
}

/** Проекцияны берілген тікбұрышқа сыйдыратын масштаб пен ығысу. */
export function fitTransform(
  bounds: Bounds,
  box: { x: number; y: number; w: number; h: number },
  padding = 0,
): { scale: number; tx: number; ty: number } {
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  const availW = box.w - 2 * padding
  const availH = box.h - 2 * padding
  const scale = Math.min(w > 0 ? availW / w : 1, h > 0 ? availH / h : 1)
  return {
    scale,
    tx: box.x + padding + (availW - w * scale) / 2 - bounds.minX * scale,
    ty: box.y + padding + (availH - h * scale) / 2 - bounds.minY * scale,
  }
}
