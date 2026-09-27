import { findNode, mergeProjectPanels, specialPartRows } from '../src/core/index'
import type { FlatScene, GroupNode, HardwarePlacement, Panel, ManualPriceItem, SpecialPartRow, Material } from '../src/core/index'

export type ProjectProduction = {
  panels: Panel[]
  hardware: HardwarePlacement[]
  moduleWidths: number[]
  manualItems: ManualPriceItem[]
  specialParts: SpecialPartRow[]
}

/** Manufacturing consumers receive the same visible nodes that the scene renders. */
export function projectProduction(root: GroupNode, scene: FlatScene, materials: Material[] = []): ProjectProduction {
  return {
    specialParts: materials.length === 0 ? [] : specialPartRows(scene.solids.flatMap((solid) => solid.spec.fabrication
      ? [{ nodeId: solid.nodeId, name: solid.name, spec: solid.spec.fabrication }] : []),
      new Map(materials.map((material) => [material.id, material]))),
    panels: mergeProjectPanels(scene.nodes.map((node) => ({
      cabinetId: node.nodeId, panels: node.panels,
    }))),
    hardware: scene.nodes.flatMap((node) => node.hardware),
    manualItems: scene.solids.filter((solid) => !solid.spec.fabrication && solid.spec.manualPriceTiyn !== undefined)
      .map((solid) => ({ nodeId: solid.nodeId, name: solid.name, priceTiyn: solid.spec.manualPriceTiyn! })),
    // Assembly is charged only for visible cabinets; boards and decorative
    // solids have no cabinet width. The existing pricing formula stays intact.
    moduleWidths: scene.nodes.flatMap((node) => {
      const source = findNode(root, node.nodeId)
      return source?.kind === 'cabinet' ? [source.config.width] : []
    }),
  }
}
