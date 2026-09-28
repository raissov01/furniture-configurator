import { findTemplate, generateCabinet, panelExtents, SEED_CATALOG, templateToCabinet } from '@/src/core/index'
import type { PanelRole, Vec3 } from '@/src/core/index'

export type CabinetFrameBox = { id: string; role: PanelRole; position: Vec3; size: Vec3 }

/** The landing frame reads the same reference template and finished panel sizes as the editor. */
export function referenceCabinetFrame(): {
  dimensions: { height: number; width: number; depth: number }; boxes: CabinetFrameBox[]
} {
  const template = findTemplate('wardrobe-penal-600')
  if (!template) throw new Error('wardrobe-penal-600 template is missing')
  const cabinet = templateToCabinet(template, SEED_CATALOG)
  const panels = generateCabinet(cabinet, SEED_CATALOG)
  const materials = new Map(SEED_CATALOG.materials.map((material) => [material.id, material]))
  const boxes = panels.map((panel) => {
    const material = materials.get(panel.materialId)
    if (!material) throw new Error(`Unknown reference material: ${panel.materialId}`)
    return { id: panel.id, role: panel.role, position: { ...panel.position },
      size: panelExtents(panel, material.thickness) }
  })
  return { dimensions: { height: cabinet.height, width: cabinet.width, depth: cabinet.depth }, boxes }
}
