import type { GroupNode, SceneNode } from '@/src/core/tree'

function referencesMaterial(value: unknown, materialId: string): boolean {
  if (Array.isArray(value)) return value.some((entry) => referencesMaterial(entry, materialId))
  if (value === null || typeof value !== 'object') return false
  return Object.entries(value).some(([key, entry]) =>
    ((key === 'materialId' || key.endsWith('MaterialId')) && entry === materialId)
    || referencesMaterial(entry, materialId))
}

/** Hidden and nested nodes retain their material references even when omitted from production. */
export function materialUsedInTree(root: GroupNode, materialId: string): boolean {
  const used = (node: SceneNode): boolean => {
    if (node.kind === 'group') return node.children.some(used)
    if (node.kind === 'board') return node.board.materialId === materialId
    if (node.kind === 'cabinet') return referencesMaterial(node.config, materialId)
    return false
  }
  return used(root)
}
