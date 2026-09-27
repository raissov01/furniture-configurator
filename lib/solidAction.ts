import { ConfigValidationError } from '@/src/core/errors'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { IDENTITY_TRANSFORM } from '@/src/core/tree'
import { ManufacturerModelSourceSchema } from '@/src/core/manufacturerAssets'
import type { GroupNode, SceneNode, SolidNode, SolidSpec } from '@/src/core/tree'
import type { Layer, Vec3 } from '@/src/core/index'

/** Starting UI dimensions for a decorative object; it is never cut from sheet material. */
export const DEFAULT_SOLID_SIZE: Vec3 = { x: 100, y: 100, z: 100 }

export function createSolidNode(id: string, name: string): SolidNode {
  if (!id.trim()) throw new ConfigValidationError('solid.id', 'id бос', 'бос емес id')
  return { kind: 'solid', id, name, transform: structuredClone(IDENTITY_TRANSFORM),
    solid: { size: { ...DEFAULT_SOLID_SIZE }, color: '#a3a3a3' } }
}

function validVec(value: Vec3, prefix: string, positive: boolean): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    if (!Number.isSafeInteger(value[axis]) || (positive && value[axis] < 1)) {
      throw new ConfigValidationError(`${prefix}.${axis}`, 'бүтін мм болуы керек',
        positive ? `1..${Number.MAX_SAFE_INTEGER} мм` : `-${Number.MAX_SAFE_INTEGER}..${Number.MAX_SAFE_INTEGER} мм`)
    }
  }
}

export function editSolidTree(root: GroupNode, id: string, layers: Layer[], change: {
  solid?: Partial<SolidSpec>; position?: Vec3
}): GroupNode {
  const source = assertTreeNodeEditable(root, id, layers)
  if (source.kind !== 'solid') throw new ConfigValidationError('nodeId', 'декоративті блок емес', 'solid id')
  const solid = { ...source.solid, ...change.solid }
  if (solid.manualPriceTiyn !== undefined && (!Number.isSafeInteger(solid.manualPriceTiyn) || solid.manualPriceTiyn < 0)) {
    throw new ConfigValidationError('solid.manualPriceTiyn', 'баға жарамсыз', '≥ 0, бүтін тиын')
  }
  if (solid.modelSource !== undefined) {
    const parsed = ManufacturerModelSourceSchema.safeParse(solid.modelSource)
    if (!parsed.success) throw new ConfigValidationError('solid.modelSource',
      parsed.error.issues[0]?.message ?? 'өндіруші сілтемесі жарамсыз', 'HTTPS бет және артикул')
  }
  const position = change.position ?? source.transform.pos
  validVec(solid.size, 'solid.size', true)
  validVec(position, 'transform.pos', false)
  if (solid.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(solid.color)) {
    throw new ConfigValidationError('solid.color', 'түс пішімі қате', '#RRGGBB')
  }
  if (JSON.stringify(solid) === JSON.stringify(source.solid) &&
      JSON.stringify(position) === JSON.stringify(source.transform.pos)) return root
  const edit = (group: GroupNode): GroupNode => ({ ...group, children: group.children.map((node): SceneNode => {
    if (node.id === id) return { ...source, solid, transform: { ...source.transform, pos: position } }
    return node.kind === 'group' ? edit(node) : node
  }) })
  return edit(root)
}
