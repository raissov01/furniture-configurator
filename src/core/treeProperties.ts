/** Copy/Paste Properties for canonical tree nodes. No panel dimensions are cached here. */
import { ConfigValidationError } from './errors'
import { assertTreeNodeEditable } from './treeEditing'
import { findNode } from './tree'
import type { Layer } from './layers'
import type { BoardSpec, GroupNode, SceneNode } from './tree'
import type { CabinetConfig, PanelEdges } from './types'

export type PropertyGroup = 'material' | 'edges' | 'dimensions'

export type PropertyClipboard =
  | { kind: 'board'; materialId?: string; edges?: PanelEdges; dimensions?: Pick<BoardSpec, 'length' | 'width'> }
  | { kind: 'cabinet'; material?: Pick<CabinetConfig, 'carcassMaterialId' | 'frontMaterialId' | 'backMaterialId'>;
    dimensions?: Pick<CabinetConfig, 'height' | 'width' | 'depth'> }

function cloneEdges(edges: PanelEdges): PanelEdges {
  return { L1: edges.L1 && { ...edges.L1 }, L2: edges.L2 && { ...edges.L2 },
    W1: edges.W1 && { ...edges.W1 }, W2: edges.W2 && { ...edges.W2 } }
}

export function copyNodeProperties(root: GroupNode, id: string, groups: readonly PropertyGroup[]): PropertyClipboard {
  const node = findNode(root, id)
  if (!node || (node.kind !== 'board' && node.kind !== 'cabinet')) {
    throw new ConfigValidationError('nodeId', 'қасиетін көшіруге болатын тақта не шкаф табылмады', 'board | cabinet id')
  }
  if (groups.length === 0) throw new ConfigValidationError('groups', 'қасиет тобы таңдалмады', 'material | edges | dimensions')
  if (node.kind === 'cabinet' && groups.includes('edges')) {
    throw new ConfigValidationError('edges', 'шкаф кромкасы жоба баптауында, жеке шкаф қасиеті емес', 'тақта кромкасы')
  }
  if (node.kind === 'board') {
    return {
      kind: 'board',
      ...(groups.includes('material') ? { materialId: node.board.materialId } : {}),
      ...(groups.includes('edges') ? { edges: cloneEdges(node.board.edges) } : {}),
      ...(groups.includes('dimensions') ? { dimensions: { length: node.board.length, width: node.board.width } } : {}),
    }
  }
  return {
    kind: 'cabinet',
    ...(groups.includes('material') ? { material: { carcassMaterialId: node.config.carcassMaterialId,
      frontMaterialId: node.config.frontMaterialId, backMaterialId: node.config.backMaterialId } } : {}),
    ...(groups.includes('dimensions') ? { dimensions: { height: node.config.height,
      width: node.config.width, depth: node.config.depth } } : {}),
  }
}

/** All recipients are validated before the immutable edit, so a multi paste cannot partially apply. */
export function pasteNodeProperties(root: GroupNode, clipboard: PropertyClipboard, ids: readonly string[], layers: Layer[]): GroupNode {
  if (ids.length === 0) throw new ConfigValidationError('nodeIds', 'қасиет қоятын нысан таңдалмады', 'кемінде бір id')
  const targets = new Set(ids)
  if (targets.size !== ids.length) throw new ConfigValidationError('nodeIds', 'id қайталанды', 'бірегей id')
  for (const id of targets) {
    const node = assertTreeNodeEditable(root, id, layers)
    if (node.kind !== clipboard.kind) {
      throw new ConfigValidationError('nodeIds', 'қасиетті тек бірдей түрдегі нысандарға қоюға болады', clipboard.kind)
    }
  }
  let changed = false
  const visit = (node: SceneNode): SceneNode => {
    if (node.kind === 'group') {
      const children = node.children.map(visit)
      return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node
    }
    if (!targets.has(node.id)) return node
    if (node.kind === 'board' && clipboard.kind === 'board') {
      const board = { ...node.board,
        ...(clipboard.materialId !== undefined ? { materialId: clipboard.materialId } : {}),
        ...(clipboard.edges !== undefined ? { edges: cloneEdges(clipboard.edges) } : {}),
        ...(clipboard.dimensions !== undefined ? { ...clipboard.dimensions } : {}),
      }
      if (JSON.stringify(board) === JSON.stringify(node.board)) return node
      changed = true
      return { ...node, board }
    }
    if (node.kind === 'cabinet' && clipboard.kind === 'cabinet') {
      const config = { ...node.config, ...clipboard.material, ...clipboard.dimensions }
      if (JSON.stringify(config) === JSON.stringify(node.config)) return node
      changed = true
      return { ...node, config }
    }
    return node
  }
  const next = visit(root) as GroupNode
  return changed ? next : root
}
