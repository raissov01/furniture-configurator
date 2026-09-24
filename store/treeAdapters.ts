/** Legacy cabinet controls read a projection of the canonical v4 tree. */
import { composePose, isNodeHiddenByLayer, ORIGIN_POSE, placementPose, roomWalls } from '../src/core/index'
import { relativeTransform } from '../src/core/treeEditing'
import type { CabinetConfig, GroupNode, Layer, Placement, Pose, Room, SceneNode, WallId } from '../src/core/index'

function closestWall(room: Room, rotationY: number): WallId {
  const walls = roomWalls(room)
  let winner = walls[0]!
  let error = Infinity
  for (const wall of walls) {
    const delta = ((rotationY - wall.rotationY + 180) % 360 + 360) % 360 - 180
    if (Math.abs(delta) < error) { winner = wall; error = Math.abs(delta) }
  }
  return winner.id
}

function placementFromPose(room: Room, cabinet: CabinetConfig, pose: Pose): Placement {
  const wall = roomWalls(room).find((entry) => entry.id === closestWall(room, pose.rotationY))!
  const x = pose.position.x - wall.origin.x - wall.inward.x * cabinet.depth
  const z = pose.position.z - wall.origin.z - wall.inward.z * cabinet.depth
  const offset = Math.round(x * wall.direction.x + z * wall.direction.z)
  return { cabinetId: cabinet.id, wall: wall.id, offset,
    ...(pose.position.y ? { elevation: pose.position.y } : {}),
    ...(pose.rotationY !== wall.rotationY ? { rotate: pose.rotationY - wall.rotationY } : {}) }
}

/** Derived adapter only; production and persistence always use `root`. */
export function cabinetsFromTree(root: GroupNode, room: Room, layers?: Layer[]): { cabinets: CabinetConfig[]; placements: Placement[] } {
  const cabinets: CabinetConfig[] = []
  const placements: Placement[] = []
  const step = (node: SceneNode, parent: Pose, hidden: boolean): void => {
    const pose = composePose(parent, node.transform)
    const concealed = hidden || node.hidden === true || (layers !== undefined && isNodeHiddenByLayer(node, layers))
    if (node.kind === 'cabinet') {
      const config = node.config.id === node.id ? node.config : { ...node.config, id: node.id }
      cabinets.push(config)
      if (!concealed) placements.push(placementFromPose(room, config, pose))
    } else if (node.kind === 'group') {
      for (const child of node.children) step(child, pose, concealed)
    }
  }
  step(root, ORIGIN_POSE, false)
  return { cabinets, placements }
}

/** Map cabinet editor changes back into existing nodes, preserving groups/boards/solids. */
export function reconcileCabinetsInTree(
  root: GroupNode,
  room: Room,
  cabinets: CabinetConfig[],
  placements: Placement[],
  movedIds: ReadonlySet<string> = new Set(),
): GroupNode {
  const byId = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]))
  const byPlacement = new Map(placements.map((placement) => [placement.cabinetId, placement]))
  const seen = new Set<string>()
  const step = (node: SceneNode, parentPose: Pose): SceneNode | null => {
    if (node.kind === 'cabinet') {
      const config = byId.get(node.id)
      if (!config) return null
      seen.add(node.id)
      const placement = byPlacement.get(node.id)
      return { ...node, name: config.name, config,
        ...(placement && movedIds.has(node.id)
          ? { transform: relativeTransform(placementPose(room, config, placement), parentPose) }
          : {}) }
    }
    if (node.kind !== 'group') return node
    const pose = composePose(parentPose, node.transform)
    return { ...node, children: node.children.flatMap((child) => {
      const next = step(child, pose)
      return next ? [next] : []
    }) }
  }
  const updated = step(root, ORIGIN_POSE) as GroupNode
  const added = cabinets.filter((cabinet) => !seen.has(cabinet.id)).map((cabinet) => {
    const placement = byPlacement.get(cabinet.id)
    return { kind: 'cabinet' as const, id: cabinet.id, name: cabinet.name,
      transform: placement
        ? relativeTransform(placementPose(room, cabinet, placement), composePose(ORIGIN_POSE, updated.transform))
        : { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      ...(placement ? {} : { hidden: true }), config: cabinet }
  })
  return added.length ? { ...updated, children: [...updated.children, ...added] } : updated
}
