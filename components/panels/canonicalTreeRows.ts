/** Presentation-only projection of the persisted v4 tree. No geometry is calculated here. */
import { findNode, projectPanelId, resolveLayer, ROLE_NAMES } from '../../src/core/index'
import type { FlatScene, GroupNode, Layer, SceneNode } from '../../src/core/index'

export type CanonicalTreeRow = {
  id: string
  nodeId: string
  parentId: string | null
  depth: number
  kind: SceneNode['kind'] | 'part'
  label: string
  hidden: boolean
  locked: boolean
  ownHidden: boolean
  ownLocked: boolean
  layerColor: string | null
  selectId: string | null
  roleLabel: string | null
  hasChildren: boolean
}

export function buildCanonicalRows(root: GroupNode, scene: FlatScene, layers: Layer[]): CanonicalTreeRow[] {
  const flatNodes = new Map(scene.nodes.map((node) => [node.nodeId, node]))
  const count = scene.nodes.length
  const rows: CanonicalTreeRow[] = []
  const visit = (node: SceneNode, parentId: string | null, depth: number, parentHidden: boolean, parentLocked: boolean): void => {
    const layer = resolveLayer(node.layerId, layers)
    const hidden = parentHidden || node.hidden === true || !layer.visible
    const locked = parentLocked || node.locked === true || layer.locked
    const flat = flatNodes.get(node.id)
    rows.push({
      id: node.id, nodeId: node.id, parentId, depth, kind: node.kind,
      label: node.name, hidden, locked, ownHidden: node.hidden === true,
      ownLocked: node.locked === true, layerColor: layer.color,
      selectId: node.kind === 'board' && flat?.panels[0]
        ? projectPanelId(node.id, flat.panels[0].id, count)
        : node.kind === 'solid' ? node.id : null,
      roleLabel: null,
      hasChildren: node.kind === 'group' ? node.children.length > 0 : Boolean(flat?.panels.length),
    })
    if (node.kind === 'group') {
      for (const child of node.children) visit(child, node.id, depth + 1, hidden, locked)
      return
    }
    if (hidden || !flat) return
    for (const panel of flat.panels) {
      rows.push({
        id: `part:${node.id}:${panel.id}`, nodeId: node.id, parentId: node.id,
        depth: depth + 1, kind: 'part', label: panel.label || ROLE_NAMES[panel.role],
        hidden, locked, ownHidden: false, ownLocked: false, layerColor: layer.color,
        selectId: projectPanelId(node.id, panel.id, count),
        roleLabel: ROLE_NAMES[panel.role], hasChildren: false,
      })
    }
  }
  visit(root, null, 0, false, false)
  return rows
}

export function selectTreeRows(
  current: string[], clicked: string, orderedIds: string[],
  modifiers: { ctrl?: boolean; shift?: boolean; anchor?: string | null } = {},
): string[] {
  if (!orderedIds.includes(clicked)) return current
  if (modifiers.shift) {
    const anchorIndex = orderedIds.indexOf(modifiers.anchor ?? '')
    const clickedIndex = orderedIds.indexOf(clicked)
    if (anchorIndex < 0) return [clicked]
    const range = orderedIds.slice(Math.min(anchorIndex, clickedIndex), Math.max(anchorIndex, clickedIndex) + 1)
    return modifiers.ctrl ? [...new Set([...current, ...range])] : range
  }
  if (modifiers.ctrl) return current.includes(clicked) ? current.filter((id) => id !== clicked) : [...current, clicked]
  return [clicked]
}

/** An unchanged 3D key must not erase a Ctrl/Shift selection made inside the tree. */
export function externalSelectionNodeIds(
  previous: string | null, selected: string | null, rows: CanonicalTreeRow[], activeId?: string,
): string[] | undefined {
  if (previous === selected) return undefined
  if (selected === null) return activeId && rows.some((row) => row.id === activeId && row.kind !== 'part') ? [activeId] : []
  const part = rows.find((row) => row.kind === 'part' && row.selectId === selected)
  if (part) return [part.nodeId]
  const node = rows.find((row) => row.kind !== 'part' && (row.selectId === selected || row.id === selected))
  return node ? [node.id] : []
}

/** A UI preflight only; the store/core remains the authoritative mutation guard. */
export function canDropInto(root: GroupNode, sourceId: string, targetId: string): boolean {
  if (sourceId === root.id || sourceId === targetId) return false
  const source = findNode(root, sourceId)
  const target = findNode(root, targetId)
  if (!source || !target || target.kind !== 'group') return false
  return source.kind !== 'group' || findNode(source, targetId) === undefined
}
