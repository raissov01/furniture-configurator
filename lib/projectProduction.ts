import { findNode, mergeProjectPanels } from '../src/core/index'
import type { FlatScene, GroupNode, HardwarePlacement, Panel, ManualPriceItem } from '../src/core/index'

export type ProjectProduction = {
  panels: Panel[]
  hardware: HardwarePlacement[]
  moduleWidths: number[]
  manualItems: ManualPriceItem[]
}

/** Manufacturing consumers receive the same visible nodes that the scene renders. */
export function projectProduction(root: GroupNode, scene: FlatScene): ProjectProduction {
  return {
    panels: mergeProjectPanels(scene.nodes.map((node) => ({
      cabinetId: node.nodeId, panels: node.panels,
    }))),
    hardware: scene.nodes.flatMap((node) => node.hardware),
    manualItems: scene.solids.filter((solid) => solid.spec.manualPriceTiyn !== undefined)
      .map((solid) => ({ nodeId: solid.nodeId, name: solid.name, priceTiyn: solid.spec.manualPriceTiyn! })),
    // Assembly is charged only for visible cabinets; boards and decorative
    // solids have no cabinet width. The existing pricing formula stays intact.
    moduleWidths: scene.nodes.flatMap((node) => {
      const source = findNode(root, node.nodeId)
      return source?.kind === 'cabinet' ? [source.config.width] : []
    }),
  }
}
