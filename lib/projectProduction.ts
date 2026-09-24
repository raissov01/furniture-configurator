import { findNode, mergeProjectPanels } from '../src/core/index'
import type { FlatScene, GroupNode, HardwarePlacement, Panel } from '../src/core/index'

export type ProjectProduction = {
  panels: Panel[]
  hardware: HardwarePlacement[]
  moduleWidths: number[]
}

/** Manufacturing consumers receive the same visible nodes that the scene renders. */
export function projectProduction(root: GroupNode, scene: FlatScene): ProjectProduction {
  return {
    panels: mergeProjectPanels(scene.nodes.map((node) => ({
      cabinetId: node.nodeId, panels: node.panels,
    }))),
    hardware: scene.nodes.flatMap((node) => node.hardware),
    // Assembly is charged only for visible cabinets; boards and decorative
    // solids have no cabinet width. The existing pricing formula stays intact.
    moduleWidths: scene.nodes.flatMap((node) => {
      const source = findNode(root, node.nodeId)
      return source?.kind === 'cabinet' ? [source.config.width] : []
    }),
  }
}
