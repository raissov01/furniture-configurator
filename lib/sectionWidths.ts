import { ConfigValidationError, layoutSections } from '../src/core/index'
import type { CabinetConfig, Catalog } from '../src/core/index'

/** Show actual section openings, including the left-to-right remainder rule. */
export function sectionWidths(cabinet: CabinetConfig, catalog: Catalog): number[] {
  const material = catalog.materials.find((item) => item.id === cabinet.carcassMaterialId)
  if (!material) throw new ConfigValidationError('carcassMaterialId', 'материал табылмады', 'каталогтағы материал')
  return layoutSections(cabinet.sections, cabinet.width - 2 * material.thickness, material.thickness, material.thickness)
    .layouts.map((layout) => layout.width)
}
