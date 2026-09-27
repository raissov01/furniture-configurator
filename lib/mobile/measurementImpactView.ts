import { calculateMeasurementImpact, type MeasurementSurvey } from '@/src/core/measure'
import type { ProjectFileV4 } from '@/src/core/projectV4'
import { cabinetsFromTree } from '@/store/treeAdapters'

export type MeasurementImpactView = {
  changedPaths: string[]
  cabinets: { id: string; name: string }[]
  /** Order number printed on this project's quote; no quote is invented without one. */
  quoteReferences: string[]
}

/** Read-only projection of the linked survey project; no panel dimensions are recalculated here. */
export function measurementImpactView(before: MeasurementSurvey, after: MeasurementSurvey, project: ProjectFileV4): MeasurementImpactView {
  const { cabinets, placements } = cabinetsFromTree(project.root, project.room, project.layers)
  const orderNo = project.info?.orderNo?.trim()
  const impact = calculateMeasurementImpact(
    before, after,
    cabinets.map((cabinet) => ({ id: cabinet.id, width: cabinet.width })),
    placements,
    orderNo ? [{ id: orderNo, cabinetIds: cabinets.map((cabinet) => cabinet.id) }] : [],
  )
  const affected = new Set(impact.cabinetIds)
  return {
    changedPaths: impact.changedPaths,
    cabinets: cabinets.filter((cabinet) => affected.has(cabinet.id)).map((cabinet) => ({ id: cabinet.id, name: cabinet.name })),
    quoteReferences: impact.quoteIds,
  }
}
