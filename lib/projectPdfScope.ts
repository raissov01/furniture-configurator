import { projectPanelId } from '@/src/core/generateCabinet'
import type { Panel } from '@/src/core/index'

/** Project IDs can be prefixed when the tree contains several manufacturing nodes. */
export function splitProjectPdfPanels(nodeId: string, assembly: Panel[], project: Panel[], nodeCount: number): {
  assembly: Panel[]; supplementary: Panel[]
} {
  const assemblyIds = new Set(assembly.map((panel) => projectPanelId(nodeId, panel.id, nodeCount)))
  return { assembly, supplementary: project.filter((panel) => !assemblyIds.has(panel.id)) }
}
