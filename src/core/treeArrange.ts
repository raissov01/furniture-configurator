/** Таңдалған ағаш түйіндерінің готовый әлем AABB-ы және бір қимылдық туралау. */
import { alignBoxes, distributeBoxes } from './align'
import type { AlignableBox, BoxAlignment } from './align'
import { ConfigValidationError } from './errors'
import { flattenTree } from './flatten'
import { panelBox } from './geometry'
import { findNode } from './tree'
import { translateTreeNodes } from './treeEditing'
import type { Box } from './geometry'
import type { GroupNode, Pose, SceneNode } from './tree'
import type { Axis, Catalog, SettingsOverride, Vec3 } from './types'
import type { Layer } from './layers'
import type { SnapFootprint } from './snap'

function outward(value: number, axis: Axis, side: 'min' | 'max'): number {
  const rounded = side === 'min' ? Math.floor(value + 1e-7) : Math.ceil(value - 1e-7)
  if (!Number.isSafeInteger(rounded)) throw new ConfigValidationError(`bounds.${axis}`, 'әлем шекарасы тым үлкен', 'қауіпсіз бүтін мм')
  return rounded === 0 ? 0 : rounded
}

function worldBox(local: Box, pose: Pose): Box {
  const angle = pose.rotationY * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const xs: number[] = []
  const zs: number[] = []
  for (const x of [local.min.x, local.max.x]) for (const z of [local.min.z, local.max.z]) {
    xs.push(pose.position.x + x * cos + z * sin)
    zs.push(pose.position.z - x * sin + z * cos)
  }
  return { min: { x: outward(Math.min(...xs), 'x', 'min'), y: outward(pose.position.y + local.min.y, 'y', 'min'), z: outward(Math.min(...zs), 'z', 'min') },
    max: { x: outward(Math.max(...xs), 'x', 'max'), y: outward(pose.position.y + local.max.y, 'y', 'max'), z: outward(Math.max(...zs), 'z', 'max') } }
}

/** Жеке жапырақ нысандардың XZ-дегі нақты бұрылған сыртқы жиектері. */
export function selectionFootprints(root: GroupNode, ids: readonly string[], catalog: Catalog, layers: Layer[],
  settings?: SettingsOverride): SnapFootprint[] {
  const scene = flattenTree(root, catalog, settings, layers)
  const footprints = new Map<string, SnapFootprint>()
  const add = (id: string, local: Box, pose: Pose) => {
    const angle = pose.rotationY * Math.PI / 180
    const cos = Math.cos(angle); const sin = Math.sin(angle)
    const point = (x: number, z: number) => ({ x: pose.position.x + x * cos + z * sin,
      z: pose.position.z - x * sin + z * cos })
    footprints.set(id, { id, minY: pose.position.y + local.min.y, maxY: pose.position.y + local.max.y,
      corners: [point(local.min.x, local.min.z), point(local.max.x, local.min.z),
        point(local.max.x, local.max.z), point(local.min.x, local.max.z)] })
  }
  for (const flat of scene.nodes) {
    const boxes = flat.panels.map((panel) => {
      const material = catalog.materials.find((entry) => entry.id === panel.materialId)
      if (!material) throw new ConfigValidationError('materialId', `материал табылмады: ${panel.materialId}`)
      return panelBox(panel, material.thickness)
    })
    if (boxes.length > 0) add(flat.nodeId, union(boxes), flat.pose)
  }
  for (const solid of scene.solids) add(solid.nodeId,
    { min: { x: 0, y: 0, z: 0 }, max: solid.spec.size }, solid.pose)
  return ids.map((id) => footprints.get(id)).filter((item): item is SnapFootprint => Boolean(item))
}

function descendants(node: SceneNode): string[] {
  return node.kind === 'group' ? node.children.flatMap(descendants) : [node.id]
}

function union(boxes: Box[]): Box {
  if (boxes.length === 0) throw new ConfigValidationError('nodeIds', 'көрінетін геометрия жоқ', 'көрінетін board, cabinet не solid')
  const min: Vec3 = { x: Infinity, y: Infinity, z: Infinity }
  const max: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const box of boxes) for (const axis of ['x', 'y', 'z'] as const) {
    min[axis] = Math.min(min[axis], box.min[axis])
    max[axis] = Math.max(max[axis], box.max[axis])
  }
  return { min, max }
}

export function selectionBoxes(root: GroupNode, ids: readonly string[], catalog: Catalog, layers: Layer[],
  settings?: SettingsOverride): AlignableBox[] {
  if (new Set(ids).size !== ids.length) throw new ConfigValidationError('nodeIds', 'id қайталанды', 'бірегей id')
  const scene = flattenTree(root, catalog, settings, layers)
  const geometry = new Map<string, Box[]>()
  for (const flat of scene.nodes) {
    const boxes = flat.panels.map((panel) => {
      const material = catalog.materials.find((entry) => entry.id === panel.materialId)
      if (!material) throw new ConfigValidationError('materialId', `материал табылмады: ${panel.materialId}`)
      return worldBox(panelBox(panel, material.thickness), flat.pose)
    })
    geometry.set(flat.nodeId, boxes)
  }
  for (const solid of scene.solids) {
    geometry.set(solid.nodeId, [worldBox({ min: { x: 0, y: 0, z: 0 }, max: solid.spec.size }, solid.pose)])
  }
  return ids.map((id) => {
    const node = findNode(root, id)
    if (!node || node.id === root.id) throw new ConfigValidationError('nodeIds', `түйін табылмады: ${id}`, 'root емес id')
    const leafIds = descendants(node)
    if (leafIds.some((entry) => entry !== id && ids.includes(entry))) {
      throw new ConfigValidationError('nodeIds', 'топ пен оның баласын бірге таңдауға болмайды', 'қиылыспайтын түйіндер')
    }
    return { id, bounds: union(leafIds.flatMap((entry) => geometry.get(entry) ?? [])) }
  })
}

export function arrangeTreeSelection(root: GroupNode, ids: readonly string[], catalog: Catalog, layers: Layer[],
  axis: Axis, mode: BoxAlignment | 'distribute', settings?: SettingsOverride): GroupNode {
  const before = selectionBoxes(root, ids, catalog, layers, settings)
  const after = mode === 'distribute' ? distributeBoxes(before, axis) : alignBoxes(before, axis, mode)
  const moves = after.flatMap((box, index) => {
    const original = before[index]!
    const delta: Vec3 = { x: box.bounds.min.x - original.bounds.min.x,
      y: box.bounds.min.y - original.bounds.min.y, z: box.bounds.min.z - original.bounds.min.z }
    return delta.x || delta.y || delta.z ? [{ id: box.id, delta }] : []
  })
  return translateTreeNodes(root, moves, layers)
}
