import type { Panel } from './types'
import type { BasisScriptScene } from './export/basisScript'

/** Excluded IDs live in page state; neither project config nor Panel[] changes. */
export function selectCutPanels(panels: readonly Panel[], excluded: ReadonlySet<string>): Panel[] {
  return panels.filter((panel) => !excluded.has(panel.materialId))
}

/** Keep the Basis script in sync with all other cut-page exports. */
export function selectCutScene(scene: BasisScriptScene, excluded: ReadonlySet<string>): BasisScriptScene {
  return { nodes: scene.nodes.map((node) => ({
    ...node,
    panels: selectCutPanels(node.panels, excluded),
  })).filter((node) => node.panels.length > 0) }
}
