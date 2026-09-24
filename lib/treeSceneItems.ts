/** 3D reads the same flattened v4 scene as manufacturing. */
import { placementPose } from '../src/core/room'
import { ConfigValidationError } from '../src/core/errors'
import { assertTreeNodeEditable } from '../src/core/treeEditing'
import { panelExtents } from '../src/core/geometry'
import { projectPanelId } from '../src/core/generateCabinet'
import { cabinetsFromTree } from '../store/treeAdapters'
import type { FlatNode, FlatScene, PlacedSolid } from '../src/core/flatten'
import type { GroupNode, SceneNode } from '../src/core/tree'
import type { Catalog, Layer, Panel, Room } from '../src/core/index'
import type { SceneItem } from '../components/Scene'

export type TreeSceneItems = {
  items: SceneItem[]
  boards: FlatNode[]
  solids: PlacedSolid[]
}

/** Camera bounds from the rendered pose, including cabinets away from walls. */
function boxFootprint(pose: SceneItem['pose'], width: number, depth: number) {
  const radians = pose.rotationY * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const points = [[0, 0], [width, 0], [width, depth], [0, depth]] as const
  const xs = points.map(([x, z]) => pose.position.x + x * cos + z * sin)
  const zs = points.map(([x, z]) => pose.position.z - x * sin + z * cos)
  const snap = (value: number) => Math.abs(value - Math.round(value)) < 1e-7 ? Math.round(value) : value
  const x = snap(Math.min(...xs))
  const z = snap(Math.min(...zs))
  return { x, z, width: snap(Math.max(...xs) - x), depth: snap(Math.max(...zs) - z) }
}

export function poseFootprint(item: Pick<SceneItem, 'cabinet' | 'pose'>) {
  return boxFootprint(item.pose, item.cabinet.width, item.cabinet.depth)
}

/** Immersive wall opening occlusion only considers actual wall cabinets. */
export function wallBoundItems(items: SceneItem[]): SceneItem[] {
  return items.filter((item) => item.wallBound !== false)
}

/** Visible geometry bounds for camera fitting, including board-only projects. */
export function treeSceneBounds(view: TreeSceneItems, catalog: Catalog) {
  const bounds: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } = {
    x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity,
  }
  const add = (pose: SceneItem['pose'], size: { x: number; y: number; z: number }) => {
    const f = boxFootprint(pose, size.x, size.z)
    bounds.x0 = Math.min(bounds.x0, f.x)
    bounds.x1 = Math.max(bounds.x1, f.x + f.width)
    bounds.y0 = Math.min(bounds.y0, pose.position.y)
    bounds.y1 = Math.max(bounds.y1, pose.position.y + size.y)
    bounds.z0 = Math.min(bounds.z0, f.z)
    bounds.z1 = Math.max(bounds.z1, f.z + f.depth)
  }
  for (const item of view.items) add(item.pose, {
    x: item.cabinet.width, y: item.cabinet.height, z: item.cabinet.depth,
  })
  for (const board of view.boards) {
    const panel = board.panels[0]
    if (!panel) continue
    const material = catalog.materials.find((entry) => entry.id === panel.materialId)
    const size = panelExtents(panel, material?.thickness ?? 16)
    add(board.pose, size)
  }
  for (const solid of view.solids) add(solid.pose, solid.spec.size)
  return bounds.x0 === Infinity ? null : bounds
}

/** Camera refits when visible geometry changes, including a resized free board. */
export function treeSceneLayoutKey(room: Room, activeId: string, view: TreeSceneItems, catalog: Catalog): string {
  const bounds = treeSceneBounds(view, catalog)
  const pose = (id: string, value: SceneItem['pose']) =>
    `${id}:${value.position.x},${value.position.y},${value.position.z},${value.rotationY}`
  return [room.width, room.depth, room.height, activeId,
    ...view.items.map((item) => `${pose(item.cabinet.id, item.pose)}:${item.cabinet.width},${item.cabinet.height},${item.cabinet.depth}`),
    ...view.boards.map((board) => pose(board.nodeId, board.pose)),
    ...view.solids.map((solid) => pose(solid.nodeId, solid.pose)),
    bounds ? `${bounds.x0},${bounds.x1},${bounds.y0},${bounds.y1},${bounds.z0},${bounds.z1}` : '',
  ].join('|')
}

/** Free boards follow the same project assembly order as cabinet panels. */
export function visibleBoardPanels(
  board: FlatNode, stepOf: Map<string, number>, stepLimit: number | null, nodeCount: number,
): Panel[] {
  return stepLimit === null ? board.panels : board.panels.filter((panel) =>
    (stepOf.get(projectPanelId(board.nodeId, panel.id, nodeCount)) ?? 0) <= stepLimit)
}

export function treeSceneItems(root: GroupNode, room: Room, scene: FlatScene, layers: Layer[]): TreeSceneItems {
  const kinds = new Map<string, SceneNode['kind']>()
  const visit = (node: SceneNode): void => {
    kinds.set(node.id, node.kind)
    if (node.kind === 'group') node.children.forEach(visit)
  }
  visit(root)
  const view = cabinetsFromTree(root, room, layers)
  const cabinets = new Map(view.cabinets.map((cabinet) => [cabinet.id, cabinet]))
  const placements = new Map(view.placements.map((placement) => [placement.cabinetId, placement]))
  const items: SceneItem[] = []
  const boards: FlatNode[] = []

  for (const node of scene.nodes) {
    if (kinds.get(node.nodeId) === 'board') {
      boards.push(node)
      continue
    }
    if (kinds.get(node.nodeId) !== 'cabinet') continue
    const cabinet = cabinets.get(node.nodeId)
    const placement = placements.get(node.nodeId)
    if (!cabinet || !placement) continue
    const wallPose = placementPose(room, cabinet, placement)
    let editable = true
    try {
      assertTreeNodeEditable(root, node.nodeId, layers)
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      editable = false
    }
    items.push({ cabinet, panels: node.panels, hardware: node.hardware, placement,
      pose: node.pose,
      editable,
      wallBound: wallPose.position.x === node.pose.position.x
        && wallPose.position.y === node.pose.position.y
        && wallPose.position.z === node.pose.position.z
        && wallPose.rotationY === node.pose.rotationY })
  }
  return { items, boards, solids: scene.solids }
}
