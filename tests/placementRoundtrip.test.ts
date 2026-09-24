/**
 * Сақтау/ашу: placement → v4 ағашы → placement. Шкаф қабырғасы ОРНЫНАН
 * анықталуы керек — бұрышы бойынша анықтаса, 45°+ бұрылған шкаф басқа
 * қабырғаға секіреді (оңтүстік, rotate=90 → x 1000 → 3400 болған).
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, SEED_SETS, placementPose, setToProject, treeFromProject } from '../src/core/index'
import type { Placement, Room, WallId } from '../src/core/index'
import { cabinetsFromTree } from '../store/treeAdapters'

const room: Room = { width: 4000, depth: 3000, height: 2700 }
const base = setToProject(SEED_SETS[0]!, SEED_CATALOG)
const cab = base.cabinets[0]!

function roundtrip(p: Placement) {
  const project = { schemaVersion: 3 as const, name: 't', materials: SEED_CATALOG.materials,
    edgeBands: SEED_CATALOG.edgeBands, cabinets: [cab], room, placements: [p] }
  const back = cabinetsFromTree(treeFromProject(project), room).placements[0]!
  return { back, before: placementPose(room, cab, p), after: placementPose(room, cab, back) }
}

describe('SEED_SETS: placement → tree → placement', () => {
  for (const set of SEED_SETS) {
    it(set.id, () => {
      const { cabinets, placements } = setToProject(set, SEED_CATALOG)
      const project = { schemaVersion: 3 as const, name: set.name, materials: SEED_CATALOG.materials,
        edgeBands: SEED_CATALOG.edgeBands, cabinets, room: set.room, placements }
      const back = cabinetsFromTree(treeFromProject(project), set.room).placements
      for (const p of placements) {
        const q = back.find((x) => x.cabinetId === p.cabinetId)!
        const c = cabinets.find((x) => x.id === p.cabinetId)!
        expect(placementPose(set.room, c, q)).toEqual(placementPose(set.room, c, p))
        expect(q.wall).toBe(p.wall)
      }
    })
  }
})

describe('қолмен бұрылған (rotate) модуль', () => {
  const walls: WallId[] = ['north', 'east', 'south', 'west']
  for (const wall of walls) for (const rotate of [0, 30, 45, 60, 90, -90, 180]) {
    it(`${wall} rotate=${rotate}`, () => {
      const { back, before, after } = roundtrip({ cabinetId: cab.id, wall, offset: 1000, elevation: 0, rotate })
      expect(after).toEqual(before)
      expect(back.wall).toBe(wall)
    })
  }
})
