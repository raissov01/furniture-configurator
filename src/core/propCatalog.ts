import type { LibraryItem } from './library'
import { findNode } from './tree'
import type { GroupNode, SceneNode, SolidNode } from './tree'
import type { Vec3 } from './types'

export type PropPart = { position: Vec3; size: Vec3; color: string }
export type PropDefinition = { id: string; name: string; category: 'Одежда' | 'Посуда' | 'Быт'; parts: readonly PropPart[] }

const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string): PropPart =>
  ({ position: { x, y, z }, size: { x: w, y: h, z: d }, color })

/** Original box-only silhouettes. The scene renderer already draws SolidNode boxes. */
export const PROP_CATALOG: readonly PropDefinition[] = [
  { id: 'folded-shirt', name: 'Сложенная рубашка', category: 'Одежда', parts: [
    box(0, 0, 0, 320, 35, 240, '#597fa1'), box(100, 35, 10, 120, 4, 50, '#dce6eb')] },
  { id: 'hanger', name: 'Вешалка', category: 'Одежда', parts: [
    box(0, 0, 0, 400, 14, 22, '#a37143'), box(189, 14, 0, 22, 80, 22, '#a37143'),
    box(189, 94, 0, 75, 16, 22, '#a37143')] },
  { id: 'shoe', name: 'Туфля', category: 'Одежда', parts: [
    box(0, 0, 0, 280, 20, 100, '#292929'), box(35, 20, 4, 150, 55, 92, '#765541'),
    box(185, 20, 8, 72, 28, 84, '#765541')] },
  { id: 'suitcase', name: 'Чемодан', category: 'Одежда', parts: [
    box(0, 0, 0, 370, 500, 200, '#52606f'), box(140, 500, 80, 90, 20, 40, '#303a43'),
    box(140, 520, 80, 18, 50, 40, '#303a43'), box(212, 520, 80, 18, 50, 40, '#303a43'),
    box(140, 570, 80, 90, 15, 40, '#303a43')] },
  { id: 'book-stack', name: 'Стопка книг', category: 'Быт', parts: [
    box(0, 0, 0, 240, 30, 160, '#b84e49'), box(8, 30, 3, 224, 28, 154, '#4c6e96'),
    box(3, 58, 5, 235, 25, 150, '#a79566')] },
  { id: 'cup', name: 'Чашка', category: 'Посуда', parts: [
    box(0, 0, 0, 90, 8, 90, '#f1eee4'), box(0, 8, 0, 8, 75, 90, '#f1eee4'),
    box(82, 8, 0, 8, 75, 90, '#f1eee4'), box(8, 8, 0, 74, 75, 8, '#f1eee4'),
    box(8, 8, 82, 74, 75, 8, '#f1eee4'), box(90, 28, 30, 40, 8, 30, '#f1eee4'),
    box(122, 28, 30, 8, 35, 30, '#f1eee4'), box(90, 55, 30, 40, 8, 30, '#f1eee4')] },
  { id: 'plates', name: 'Стопка тарелок', category: 'Посуда', parts: [
    box(0, 0, 0, 220, 12, 220, '#e8e4d9'), box(0, 19, 0, 220, 12, 220, '#e8e4d9'),
    box(0, 38, 0, 220, 12, 220, '#e8e4d9')] },
  { id: 'plant', name: 'Комнатное растение', category: 'Быт', parts: [
    box(30, 0, 30, 150, 145, 150, '#af7956'), box(95, 145, 95, 20, 250, 20, '#4c7043'),
    box(20, 280, 90, 170, 38, 30, '#5c8a4e'), box(90, 330, 20, 30, 35, 170, '#4c7043')] },
  { id: 'lamp', name: 'Настольная лампа', category: 'Быт', parts: [
    box(0, 0, 0, 200, 18, 200, '#353b40'), box(90, 18, 90, 20, 310, 20, '#58636a'),
    box(30, 328, 30, 140, 85, 140, '#e9d9ae')] },
]

const identity = () => ({ pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } })

export function makePropLibraryItem(prop: PropDefinition, position: Vec3, createdAt: string): LibraryItem {
  if (Object.values(position).some((value) => !Number.isInteger(value))) {
    throw new Error('prop position: integer millimetres required')
  }
  const children: SolidNode[] = prop.parts.map((part, index) => ({
    kind: 'solid', id: `${prop.id}-piece-${index}`, name: `prop-piece:${prop.id}:${index}`,
    transform: { ...identity(), pos: part.position },
    solid: { size: part.size, color: part.color },
  }))
  const sizeHint = prop.parts.reduce<Vec3>((max, part) => ({
    x: Math.max(max.x, part.position.x + part.size.x),
    y: Math.max(max.y, part.position.y + part.size.y),
    z: Math.max(max.z, part.position.z + part.size.z),
  }), { x: 0, y: 0, z: 0 })
  return {
    schemaVersion: 1, id: `owned-prop-${prop.id}`, name: prop.name, category: prop.category,
    node: { kind: 'group', id: `prop-${prop.id}`, name: prop.name,
      transform: { ...identity(), pos: position }, children },
    materials: [], edgeBands: [], meta: { createdAt, sizeHint },
  }
}

export function isPlacedProp(node: SceneNode): node is GroupNode {
  return node.kind === 'group' && node.children.length > 0 &&
    node.children.every((child) => child.kind === 'solid' && child.name.startsWith('prop-piece:'))
}

export function placedProps(root: GroupNode): GroupNode[] {
  const found: GroupNode[] = []
  const visit = (group: GroupNode) => {
    for (const child of group.children) if (child.kind === 'group') {
      if (isPlacedProp(child)) found.push(child)
      else visit(child)
    }
  }
  visit(root)
  return found
}

export function removePropNode(root: GroupNode, id: string): GroupNode {
  const target = findNode(root, id)
  if (!target || !isPlacedProp(target)) throw new Error(`prop not found: ${id}`)
  const remove = (group: GroupNode): GroupNode => ({ ...group,
    children: group.children.filter((child) => child.id !== id).map((child) =>
      child.kind === 'group' ? remove(child) : child),
  })
  return remove(root)
}
