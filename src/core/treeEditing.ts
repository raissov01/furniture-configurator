/** Immutable editor operations for the canonical scene tree. */
import { ConfigValidationError } from './errors'
import { assertNodeEditable, isNodeHiddenByLayer } from './layers'
import { findNode, walkTree } from './tree'
import type { Layer } from './layers'
import type { GroupNode, Pose, SceneNode, Transform } from './tree'

function parentOf(root: GroupNode, id: string): GroupNode | undefined {
  const visit = (group: GroupNode): GroupNode | undefined => {
    if (group.children.some((child) => child.id === id)) return group
    for (const child of group.children) {
      if (child.kind === 'group') {
        const found = visit(child)
        if (found) return found
      }
    }
    return undefined
  }
  return visit(root)
}

export function assertTreeNodeEditable(root: GroupNode, id: string, layers: Layer[]): SceneNode {
  const node = findNode(root, id)
  if (!node || node.id === root.id) {
    throw new ConfigValidationError('nodeId', `түйін табылмады немесе root: ${id}`, 'root емес түйін id')
  }
  // A locked parent also locks every descendant, regardless of the child's flag.
  let cursor: SceneNode | undefined = node
  while (cursor) {
    assertNodeEditable(cursor, layers)
    cursor = parentOf(root, cursor.id)
  }
  return node
}

function mapGroup(root: GroupNode, id: string, update: (group: GroupNode) => GroupNode): GroupNode {
  if (root.id === id) return update(root)
  return { ...root, children: root.children.map((child) =>
    child.kind === 'group' ? mapGroup(child, id, update) : child) }
}

function worldPose(root: GroupNode, id: string): Pose {
  let result: Pose | undefined
  walkTree(root, (node, pose) => { if (node.id === id) result = pose })
  if (!result) throw new ConfigValidationError('nodeId', `түйін табылмады: ${id}`)
  return result
}

export function relativeTransform(world: Pose, parent: Pose): Transform {
  const radians = parent.rotationY * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = world.position.x - parent.position.x
  const dz = world.position.z - parent.position.z
  const x = dx * cos - dz * sin
  const z = dx * sin + dz * cos
  const round = (value: number, axis: string): number => {
    const integer = Math.round(value)
    if (Math.abs(value - integer) > 1e-7) {
      throw new ConfigValidationError(`transform.pos.${axis}`, 'орын бүтін мм емес', 'бүтін мм')
    }
    return integer === 0 ? 0 : integer
  }
  return { pos: { x: round(x, 'x'), y: round(world.position.y - parent.position.y, 'y'), z: round(z, 'z') },
    rot: { x: 0, y: world.rotationY - parent.rotationY, z: 0 } }
}

export function renameTreeNode(root: GroupNode, id: string, name: string, layers: Layer[]): GroupNode {
  assertTreeNodeEditable(root, id, layers)
  const clean = name.trim()
  if (!clean) throw new ConfigValidationError('node.name', 'атауы бос', 'кемінде бір таңба')
  const parent = parentOf(root, id)!
  return mapGroup(root, parent.id, (group) => ({ ...group, children: group.children.map((node) =>
    node.id === id ? { ...node, name: clean, ...(node.kind === 'cabinet' ? { config: { ...node.config, name: clean } } : {}) } : node) }))
}

export function setTreeNodeFlag(root: GroupNode, id: string, flag: 'hidden' | 'locked', value: boolean, layers: Layer[]): GroupNode {
  if (id === root.id) throw new ConfigValidationError('nodeId', 'root түйінін өзгертуге болмайды', 'root емес id')
  if (flag === 'locked' && value === false) {
    const node = findNode(root, id)
    if (!node) throw new ConfigValidationError('nodeId', `түйін табылмады: ${id}`)
    // Unlocking oneself is allowed, but a locked ancestor/layer still blocks it.
    assertNodeEditable({ ...node, locked: false }, layers)
    let cursor: SceneNode | undefined = parentOf(root, id)
    while (cursor) { assertNodeEditable(cursor, layers); cursor = parentOf(root, cursor.id) }
  } else assertTreeNodeEditable(root, id, layers)
  const parent = parentOf(root, id)!
  return mapGroup(root, parent.id, (group) => ({ ...group, children: group.children.map((node) =>
    node.id === id ? { ...node, [flag]: value } : node) }))
}

export function reparentNode(root: GroupNode, id: string, targetGroupId: string, layers: Layer[]): GroupNode {
  const node = assertTreeNodeEditable(root, id, layers)
  const target = targetGroupId === root.id ? root : assertTreeNodeEditable(root, targetGroupId, layers)
  if (target.kind !== 'group') throw new ConfigValidationError('parentId', 'ата түйін топ емес', 'group id')
  if (parentOf(root, id)?.id === target.id) return root
  let cursor: GroupNode | undefined = target
  while (cursor) {
    if (cursor.id === id) throw new ConfigValidationError('parentId', 'топ өзін-өзі қамти алмайды', 'бөтен group id')
    cursor = parentOf(root, cursor.id)
  }
  const transform = relativeTransform(worldPose(root, id), worldPose(root, targetGroupId))
  const from = parentOf(root, id)!
  const removed = mapGroup(root, from.id, (group) => ({ ...group, children: group.children.filter((child) => child.id !== id) }))
  return mapGroup(removed, targetGroupId, (group) => ({ ...group, children: [...group.children, { ...node, transform }] }))
}

export function groupNodes(root: GroupNode, ids: string[], groupId: string, name: string, layers: Layer[]): GroupNode {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw new ConfigValidationError('nodeIds', 'кемінде екі бөлек түйін керек')
  if (findNode(root, groupId)) throw new ConfigValidationError('groupId', 'id қайталанды')
  ids.forEach((id) => assertTreeNodeEditable(root, id, layers))
  const parent = parentOf(root, ids[0]!)!
  if (ids.some((id) => parentOf(root, id)?.id !== parent.id)) throw new ConfigValidationError('nodeIds', 'түйіндер бір атада болуы керек')
  const selected = new Set(ids)
  const first = parent.children.findIndex((child) => selected.has(child.id))
  return mapGroup(root, parent.id, (group) => {
    const children = group.children.filter((child) => !selected.has(child.id))
    children.splice(first, 0, { kind: 'group', id: groupId, name: name.trim() || 'Топ',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      children: group.children.filter((child) => selected.has(child.id)) })
    return { ...group, children }
  })
}

export function ungroupNode(root: GroupNode, id: string, layers: Layer[]): GroupNode {
  const node = assertTreeNodeEditable(root, id, layers)
  if (node.kind !== 'group') throw new ConfigValidationError('nodeId', 'тек топты таратуға болады')
  for (const child of node.children) assertTreeNodeEditable(root, child.id, layers)
  const parent = parentOf(root, id)!
  const parentPose = worldPose(root, parent.id)
  const concealed = node.hidden === true || isNodeHiddenByLayer(node, layers)
  const children = node.children.map((child) => ({ ...child,
    ...(concealed ? { hidden: true } : {}),
    transform: relativeTransform(worldPose(root, child.id), parentPose) }))
  return mapGroup(root, parent.id, (group) => ({ ...group,
    children: group.children.flatMap((child) => child.id === id ? children : [child]) }))
}
