/** A side filler is laminated from the selected carcass sheet. */
export function drawerFillerStep(materials: readonly { id: string; thickness: number }[], materialId: string): number | null {
  const thickness = materials.find((material) => material.id === materialId)?.thickness
  return thickness && Number.isSafeInteger(thickness) && thickness > 0 ? thickness : null
}
