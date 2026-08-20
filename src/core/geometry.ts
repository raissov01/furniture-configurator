/**
 * Панельдің 3D-дегі орналасуы. Таза математика — three.js импорты ЖОҚ,
 * бірақ шығатын бұрыштар three.js Euler order 'XYZ' келісімінде, ГРАДУСПЕН.
 *
 * Кабинет өстері: X — солдан оңға, Y — төменнен жоғары, Z — алдыңғы беттен артқа.
 */

import type { Orientation, Panel, Vec3 } from './types.js'

/** Тік панель, бүйірімен тұрады (боковина, перегородка): ұзындығы — биіктік. */
export const ORIENT_SIDE: Orientation = { length: 'y', width: 'z', thickness: 'x' }

/** Жатық панель (крышка, дно, полка): ұзындығы — солдан оңға. */
export const ORIENT_HORIZONTAL: Orientation = { length: 'x', width: 'z', thickness: 'y' }

/** Тік панель, алға қарайды (задняя стенка, фасад): ұзындығы — биіктік. */
export const ORIENT_FACING: Orientation = { length: 'y', width: 'x', thickness: 'z' }

/**
 * Локал өстер картасынан three.js Euler ('XYZ', градус) шығару.
 *
 * Локал куб әрқашан (length→X, width→Y, thickness→Z) күйінде жасалады, содан соң
 * мына бұрышпен бұрылады. Үш ғана нұсқа бар — бәрі осьтерге параллель:
 *
 *   ORIENT_SIDE       x→y, y→z, z→x   ⇒ (90, 90,   0)
 *   ORIENT_HORIZONTAL x→x, y→z, z→−y  ⇒ (90,  0,   0)
 *   ORIENT_FACING     x→y, y→x, z→−z  ⇒ (180, 0, −90)
 */
export function rotationFor(o: Orientation): Vec3 {
  const key = `${o.length}${o.width}${o.thickness}`
  switch (key) {
    case 'yzx':
      return { x: 90, y: 90, z: 0 }
    case 'xzy':
      return { x: 90, y: 0, z: 0 }
    case 'yxz':
      return { x: 180, y: 0, z: -90 }
    default:
      throw new Error(`rotationFor: белгісіз бағдар ${key}`)
  }
}

/** Панельдің АЖШ (AABB) өлшемдері. ГОТОВЫЙ өлшемді алады — 3D готовый көрсетеді. */
export function panelExtents(panel: Panel, thickness: number): Vec3 {
  const e: Vec3 = { x: 0, y: 0, z: 0 }
  e[panel.orientation.length] = panel.finishedLength
  e[panel.orientation.width] = panel.finishedWidth
  e[panel.orientation.thickness] = thickness
  return e
}

export type Box = { min: Vec3; max: Vec3 }

export function panelBox(panel: Panel, thickness: number): Box {
  const e = panelExtents(panel, thickness)
  return {
    min: { ...panel.position },
    max: {
      x: panel.position.x + e.x,
      y: panel.position.y + e.y,
      z: panel.position.z + e.z,
    },
  }
}

/** Екі қораптың көлемі қиылыса ма (жанасу — қиылысу емес). */
export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.min.x < b.max.x && b.min.x < a.max.x &&
    a.min.y < b.max.y && b.min.y < a.max.y &&
    a.min.z < b.max.z && b.min.z < a.max.z
  )
}
