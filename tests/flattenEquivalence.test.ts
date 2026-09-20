/**
 * БАСТЫ КЕПІЛ: ағаш жолы = ескі жол.
 *
 * Ескі жол:  cabinets[] + placements[] → generateCabinet + placementPose
 * Жаңа жол:  treeFromProject → flattenTree
 *
 * Екеуі де бірдей панель, бірдей фурнитура, бірдей поза беруі керек. Бұл
 * тест өтсе — 2-фазада сторды ағашқа көшіргенде деталировка да, раскрой да,
 * смета да, присадка да, DXF те бұзылмайды.
 *
 * Тест `SEED_SETS`-тің БӘРІН аралайды: ас үй, шкаф, балалар бөлмесі —
 * әрқайсысы бірнеше модульден тұрады, қабырғасы мен бұрышы әртүрлі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, SEED_SETS, flattenTree, formatCutList, generateCabinet,
  generateHardware, placementPose, scenePanels, setToProject, treeFromProject,
} from '../src/core/index'
import type { ProjectFile } from '../src/core/index'

/**
 * `setToProject` толық ProjectFile ЕМЕС, тек { cabinets, placements } береді —
 * қалған өрістерді осында жинаймыз. Бөлме — жиынтықтың өз ең кіші бөлмесі.
 */
const projects: { name: string; project: ProjectFile }[] = SEED_SETS.map((set) => {
  const { cabinets, placements } = setToProject(set, SEED_CATALOG)
  return {
    name: set.id,
    project: {
      schemaVersion: 3,
      name: set.name,
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets,
      room: set.room,
      placements,
    },
  }
})

describe('ағаш жолы = ескі жол', () => {
  it('тексерілетін жоба бар', () => {
    expect(projects.length).toBeGreaterThan(0)
  })

  for (const { name, project } of projects) {
    describe(name, () => {
      const scene = flattenTree(treeFromProject(project), SEED_CATALOG, project.settings)

      it('түйін саны — орны бар шкаф саны', () => {
        const placed = project.cabinets.filter((c) =>
          project.placements.some((p) => p.cabinetId === c.id))
        expect(scene.nodes).toHaveLength(placed.length)
      })

      it('әр шкафтың панельдері БІРДЕЙ', () => {
        for (const cabinet of project.cabinets) {
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
          if (!node) continue
          expect(node.panels).toEqual(generateCabinet(cabinet, SEED_CATALOG, project.settings))
        }
      })

      it('әр шкафтың фурнитурасы БІРДЕЙ', () => {
        for (const cabinet of project.cabinets) {
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
          if (!node) continue
          expect(node.hardware).toEqual(generateHardware(cabinet, SEED_CATALOG, project.settings))
        }
      })

      it('әр шкафтың позасы placementPose-пен БІРДЕЙ', () => {
        for (const placement of project.placements) {
          const cabinet = project.cabinets.find((c) => c.id === placement.cabinetId)
          if (!cabinet) continue
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)!
          expect(node.pose).toEqual(placementPose(project.room, cabinet, placement))
        }
      })

      it('деталировка БІРДЕЙ', () => {
        const oldPanels = project.cabinets
          .filter((c) => project.placements.some((p) => p.cabinetId === c.id))
          .flatMap((c) => generateCabinet(c, SEED_CATALOG, project.settings))
        expect(formatCutList(scenePanels(scene), SEED_CATALOG))
          .toEqual(formatCutList(oldPanels, SEED_CATALOG))
      })
    })
  }
})
