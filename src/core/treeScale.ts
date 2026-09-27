/** Scale editor geometry through the canonical config tree; dimensions stay integer mm. */
import { ConfigValidationError } from './errors'
import { assertTreeNodeEditable } from './treeEditing'
import type { Layer } from './layers'
import type { GroupNode, SceneNode } from './tree'
import type { Axis, Vec3 } from './types'

export type ScalePercent = Record<Axis, number>

function scaledMm(value: number, percent: number, field: string, positive = false): number {
  const result = Math.round(value * percent / 100)
  if (!Number.isSafeInteger(result) || (positive && result < 1)) {
    throw new ConfigValidationError(field, 'масштабталған өлшем жарамсыз', '1 мм-ден кем емес қауіпсіз бүтін мм')
  }
  return result
}

function childFactors(parent: ScalePercent, degrees: number): ScalePercent {
  if (parent.x === parent.z) return parent
  const quarter = degrees / 90
  if (!Number.isInteger(quarter)) {
    throw new ConfigValidationError('transform.rot.y', 'қиғаш бұрыштағы топты ось бойынша масштабтау панельді қисайтады', '90° еселі бұрыш не біркелкі масштаб')
  }
  return Math.abs(quarter % 2) === 1 ? { x: parent.z, y: parent.y, z: parent.x } : parent
}

function scalePosition(pos: Vec3, factors: ScalePercent): Vec3 {
  return {
    x: scaledMm(pos.x, factors.x, 'transform.pos.x'),
    y: scaledMm(pos.y, factors.y, 'transform.pos.y'),
    z: scaledMm(pos.z, factors.z, 'transform.pos.z'),
  }
}

/** Scale one selected node about its local origin. A group's child offsets scale with its contents. */
export function scaleTreeNode(root: GroupNode, id: string, factors: ScalePercent, layers: Layer[]): GroupNode {
  for (const axis of ['x', 'y', 'z'] as const) {
    if (!Number.isSafeInteger(factors[axis]) || factors[axis] <= 0) {
      throw new ConfigValidationError(`scale.${axis}`, 'масштаб оң бүтін пайыз болуы керек', '1% немесе одан көп')
    }
  }
  const selected = assertTreeNodeEditable(root, id, layers)
  if (factors.x === 100 && factors.y === 100 && factors.z === 100) return root
  const scaleBody = (node: SceneNode, local: ScalePercent): SceneNode => {
    assertTreeNodeEditable(root, node.id, layers)
    if (node.kind === 'group') return { ...node, children: node.children.map((child) => {
      const transform = { ...child.transform, pos: scalePosition(child.transform.pos, local) }
      const body = scaleBody(child, childFactors(local, child.transform.rot.y))
      return { ...body, transform }
    }) }
    if (node.kind === 'cabinet') return { ...node, config: { ...node.config,
      height: scaledMm(node.config.height, local.y, 'config.height', true),
      width: scaledMm(node.config.width, local.x, 'config.width', true),
      depth: scaledMm(node.config.depth, local.z, 'config.depth', true),
    } }
    if (node.kind === 'board') {
      // The material's physical thickness stays fixed; only the two cut-plane axes change.
      const length = scaledMm(node.board.length, local[node.board.orientation.length], 'board.length', true)
      const width = scaledMm(node.board.width, local[node.board.orientation.width], 'board.width', true)
      if (length !== node.board.length || width !== node.board.width) {
        // These coordinates are entered on the cut panel. Resizing the outline without
        // moving the machine path would silently corrupt production data.
        const dependent = node.board.drilling?.length ? 'drilling'
          : node.board.cutouts?.length ? 'cutouts'
            : node.board.corners ? 'corners'
              : node.board.milling?.length ? 'milling'
                : node.board.contour ? 'contour' : null
        if (dependent) throw new ConfigValidationError(`board.${dependent}`,
          'станок координатасы бар тақтаны өлшемдеп масштабтауға болмайды',
          'алдымен присадка/ойманы қайта есептеңіз немесе бос тақтаны таңдаңыз')
      }
      return { ...node, board: { ...node.board, length, width } }
    }
    if (node.kind === 'solid') return { ...node, solid: { ...node.solid, size: {
      x: scaledMm(node.solid.size.x, local.x, 'solid.size.x', true),
      y: scaledMm(node.solid.size.y, local.y, 'solid.size.y', true),
      z: scaledMm(node.solid.size.z, local.z, 'solid.size.z', true),
    } } }
    return node
  }
  const replace = (group: GroupNode): GroupNode => ({ ...group, children: group.children.map((child) => {
    if (child.id === selected.id) return scaleBody(child, factors)
    return child.kind === 'group' ? replace(child) : child
  }) })
  return replace(root)
}
