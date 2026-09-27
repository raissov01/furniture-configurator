/** A display filter never changes nesting, totals, or exports. */
export function visibleMaterials<T extends { materialId: string }>(
  materials: readonly T[], selected: string,
): readonly T[] {
  return selected === 'all' ? materials : materials.filter((item) => item.materialId === selected)
}

