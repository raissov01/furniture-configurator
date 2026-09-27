import { ConfigValidationError } from '@/src/core/errors'
import { mirrorFreeNodeX } from '@/src/core/mirrorFree'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { walkTree } from '@/src/core/tree'
import type { GroupNode, SceneNode } from '@/src/core/tree'
import type { Catalog, Layer, SettingsOverride } from '@/src/core/index'

/** Inserts a mirror beside its source. The source's local X origin is the mirror plane. */
export function appendFreeMirror(root: GroupNode, id: string, catalog: Catalog, layers: Layer[], settings?: SettingsOverride): {
  root: GroupNode; id: string
} {
  const source = assertTreeNodeEditable(root, id, layers)
  const existing = new Set<string>()
  walkTree(root, (node) => existing.add(node.id))
  const idsOf = (node: SceneNode): string[] => node.kind === 'group'
    ? [node.id, ...node.children.flatMap(idsOf)] : [node.id]
  let index = 1
  let copy: SceneNode
  do {
    copy = mirrorFreeNodeX(source, catalog, source.transform.pos.x, `-mirror-${index}`, settings)
    index += 1
  } while (idsOf(copy).some((copyId) => existing.has(copyId)))

  const insert = (group: GroupNode): GroupNode => ({ ...group, children: group.children.flatMap((node) => {
    if (node.id === id) return [node, copy]
    return [node.kind === 'group' ? insert(node) : node]
  }) })
  const next = insert(root)
  if (next === root) throw new ConfigValidationError('nodeId', `түйін табылмады: ${id}`)
  return { root: next, id: copy.id }
}

export function freeMirrorAvailability(root: GroupNode, id: string, catalog: Catalog, layers: Layer[], settings?: SettingsOverride): {
  ok: boolean; reason?: string
} {
  try { appendFreeMirror(root, id, catalog, layers, settings); return { ok: true } }
  catch (cause) {
    if (!(cause instanceof ConfigValidationError)) throw cause
    return { ok: false, reason: cause.message }
  }
}
