/** Жеке кітапхана: сақталатыны SceneNode, өндіріс әр қоюда қайта есептеледі. */
import { z } from 'zod'
import { ConfigValidationError } from './errors'
import { generateCabinet } from './generateCabinet'
import { applyMaterialReplace } from './replaceMaterial'
import { SceneNodeSchema } from './projectV4'
import { EdgeBandSchema, MaterialSchema } from './schema'
import { findNode } from './tree'
import { assertTreeNodeEditable } from './treeEditing'
import type { GroupNode, SceneNode } from './tree'
import type { Layer } from './layers'
import type { Catalog, EdgeBand, Material, Panel, SettingsOverride, Vec3 } from './types'

export type LibraryItem = {
  schemaVersion: 1
  id: string
  name: string
  category: string
  node: SceneNode
  materials: Material[]
  edgeBands: EdgeBand[]
  thumbnail?: string | undefined
  meta: { author?: string | undefined; createdAt: string; sizeHint: Vec3 }
}

const integer = z.number().int().nonnegative()
export const LibraryItemSchema: z.ZodType<LibraryItem> = z.strictObject({
  schemaVersion: z.literal(1), id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(120),
  node: SceneNodeSchema, materials: z.array(MaterialSchema), edgeBands: z.array(EdgeBandSchema),
  thumbnail: z.string().max(65_536).optional(),
  meta: z.strictObject({ author: z.string().max(120).optional(), createdAt: z.iso.datetime(),
    sizeHint: z.strictObject({ x: integer, y: integer, z: integer }) }),
})

export function parseLibraryItem(raw: unknown): LibraryItem {
  const item = LibraryItemSchema.parse(raw)
  const materials = new Set(item.materials.map((material) => material.id))
  const bands = new Set(item.edgeBands.map((band) => band.id))
  const requireMaterial = (id: string) => {
    if (!materials.has(id)) throw new ConfigValidationError('library.materials', `materialId табылмады: ${id}`)
  }
  const requireBand = (id: string) => {
    if (!bands.has(id)) throw new ConfigValidationError('library.edgeBands', `bandId табылмады: ${id}`)
  }
  visit(item.node, (node) => {
    if (node.kind === 'board') {
      requireMaterial(node.board.materialId)
      for (const edge of Object.values(node.board.edges)) if (edge) requireBand(edge.bandId)
    } else if (node.kind === 'cabinet') visitMaterialIds(node.config, requireMaterial)
  })
  for (const material of item.materials) {
    if (material.defaultEdging) for (const bandId of Object.values(material.defaultEdging)) if (bandId) requireBand(bandId)
  }
  const actualSize = sizeHint(item.node, { materials: item.materials, edgeBands: item.edgeBands })
  if (actualSize.x !== item.meta.sizeHint.x || actualSize.y !== item.meta.sizeHint.y || actualSize.z !== item.meta.sizeHint.z) {
    throw new ConfigValidationError('library.meta.sizeHint', 'sizeHint түйін өлшеміне сай емес')
  }
  return item
}

function visit(node: SceneNode, fn: (node: SceneNode) => void): void {
  fn(node)
  if (node.kind === 'group') node.children.forEach((child) => visit(child, fn))
}

function visitMaterialIds(value: unknown, collect: (id: string) => void): void {
  if (Array.isArray(value)) { value.forEach((entry) => visitMaterialIds(entry, collect)); return }
  if (value === null || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if ((key === 'materialId' || key.endsWith('MaterialId')) && typeof entry === 'string') collect(entry)
    else visitMaterialIds(entry, collect)
  }
}

function sizeHint(node: SceneNode, catalog: Catalog): Vec3 {
  if (node.kind === 'cabinet') return { x: node.config.width, y: node.config.height, z: node.config.depth }
  if (node.kind === 'solid') return { ...node.solid.size }
  // Кітапхана нобайына шамамен мәтін орны; өндірістік өлшем емес.
  if (node.kind === 'annotation') return {
    x: Math.round(node.annotation.fontSize * node.annotation.text.length / 2),
    y: node.annotation.fontSize, z: 0,
  }
  if (node.kind === 'board') {
    const material = catalog.materials.find((item) => item.id === node.board.materialId)
    if (!material) throw new ConfigValidationError('materialId', `материал табылмады: ${node.board.materialId}`)
    const result: Vec3 = { x: 0, y: 0, z: 0 }
    result[node.board.orientation.length] = node.board.length
    result[node.board.orientation.width] = node.board.width
    result[node.board.orientation.thickness] = material.thickness
    return result
  }
  const result: Vec3 = { x: 0, y: 0, z: 0 }
  for (const child of node.children) {
    const childSize = sizeHint(child, catalog)
    for (const axis of ['x', 'y', 'z'] as const) {
      result[axis] = Math.max(result[axis], child.transform.pos[axis] + childSize[axis])
    }
  }
  return result
}

export function createLibraryItem(node: SceneNode, catalog: Catalog, category: string,
  createdAt: string, id: string, settings?: SettingsOverride): LibraryItem {
  const materialIds = new Set<string>()
  const bandIds = new Set<string>()
  const collectPanel = (panel: Panel) => {
    materialIds.add(panel.materialId)
    for (const edge of Object.values(panel.edges)) if (edge) bandIds.add(edge.bandId)
  }
  visit(node, (part) => {
    if (part.kind === 'board') {
      materialIds.add(part.board.materialId)
      for (const edge of Object.values(part.board.edges)) if (edge) bandIds.add(edge.bandId)
    } else if (part.kind === 'cabinet') {
      visitMaterialIds(part.config, (materialId) => { materialIds.add(materialId) })
      generateCabinet(part.config, catalog, settings).forEach(collectPanel)
    }
  })
  const materials = [...materialIds].map((materialId) => {
    const material = catalog.materials.find((candidate) => candidate.id === materialId)
    if (!material) throw new ConfigValidationError('materialId', `материал табылмады: ${materialId}`)
    return material
  })
  for (const material of materials) {
    if (material.defaultEdging) for (const bandId of Object.values(material.defaultEdging)) if (bandId) bandIds.add(bandId)
  }
  const edgeBands = [...bandIds].map((bandId) => {
    const band = catalog.edgeBands.find((candidate) => candidate.id === bandId)
    if (!band) throw new ConfigValidationError('bandId', `кромка табылмады: ${bandId}`)
    return band
  })
  return parseLibraryItem({ schemaVersion: 1, id, name: node.name, category, node,
    materials, edgeBands, meta: { createdAt, sizeHint: sizeHint(node, catalog) } })
}

/** Бір ID екі түрлі физикалық материалды білдірсе, үнсіз біріктіруге болмайды. */
export function mergeLibraryCatalog(catalog: Catalog, item: LibraryItem): Catalog {
  const merge = <T extends { id: string }>(existing: T[], additions: T[], field: string,
    physical: (entry: T) => unknown): T[] => {
    const result = [...existing]
    for (const entry of additions) {
      const old = result.find((candidate) => candidate.id === entry.id)
      if (!old) result.push(entry)
      else if (JSON.stringify(physical(old)) !== JSON.stringify(physical(entry))) {
        throw new ConfigValidationError(field, `ID қақтығысы: ${entry.id}`, 'басқа материал ID-і')
      }
    }
    return result
  }
  // Баға мен PBR (тек 3D көрініс) физикалық материалды өзгертпейді: жобадағысы қалады.
  return { materials: merge(catalog.materials, item.materials, 'materials', ({ pricePerSheet: _price,
    pbr: _pbr, slab, ...material }) => ({ ...material, slab: slab ? { ...slab, pricePerMeter: 0 } : undefined })),
  edgeBands: merge(catalog.edgeBands, item.edgeBands, 'edgeBands', ({ pricePerMeter: _price, ...band }) => band) }
}

/** ID қайта тағайындалады; cabinet.config.id де түйін ID-імен бірдей болуы тиіс. */
export function insertLibraryItem(root: GroupNode, item: LibraryItem, catalog: Catalog,
  parentId: string, makeId: () => string): GroupNode {
  const parsed = parseLibraryItem(item)
  mergeLibraryCatalog(catalog, parsed)
  const target = findNode(root, parentId)
  if (target?.kind !== 'group') throw new ConfigValidationError('parentId', `топ табылмады: ${parentId}`)
  const seen = new Set<string>()
  visit(root, (node) => { seen.add(node.id) })
  const copy = (node: SceneNode): SceneNode => {
    const id = makeId()
    if (seen.has(id)) throw new ConfigValidationError('node.id', `ID қайталанды: ${id}`)
    seen.add(id)
    const base = { ...node, id, layerId: undefined }
    if (node.kind === 'group') return { ...base, kind: 'group', children: node.children.map(copy) }
    if (node.kind === 'cabinet') return { ...base, kind: 'cabinet', config: { ...node.config, id } }
    return base
  }
  const inserted = copy(parsed.node)
  const append = (group: GroupNode): GroupNode => ({ ...group, children: group.children.map((node) =>
    node.kind === 'group' ? append(node) : node).concat(group.id === parentId ? [inserted] : []) })
  return append(root)
}

export function replaceLibraryMaterial(item: LibraryItem, oldId: string, nextMaterial: Material,
  catalog: Catalog): LibraryItem {
  const replace = (node: SceneNode): SceneNode => {
    if (node.kind === 'group') return { ...node, children: node.children.map(replace) }
    if (node.kind === 'board') return { ...node, board: { ...node.board,
      materialId: node.board.materialId === oldId ? nextMaterial.id : node.board.materialId } }
    if (node.kind === 'cabinet') return { ...node,
      config: applyMaterialReplace([node.config], oldId, nextMaterial.id, { kind: 'all' })[0]! }
    return node
  }
  const revisedCatalog = { ...catalog, materials: [...catalog.materials.filter((material) => material.id !== nextMaterial.id), nextMaterial] }
  const result = createLibraryItem(replace(item.node), revisedCatalog, item.category, item.meta.createdAt, item.id)
  return { ...result, thumbnail: item.thumbnail, meta: { ...result.meta, author: item.meta.author } }
}

/** «Замена» еркін тақталарды тек канондық SceneNode ағашында өзгертеді. */
export function replaceTreeBoardMaterial(root: GroupNode, oldId: string, newId: string, layers?: Layer[]): GroupNode {
  let changed = false
  const replace = (node: SceneNode): SceneNode => {
    if (node.kind === 'group') {
      const children = node.children.map(replace)
      return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node
    }
    if (node.kind !== 'board' || node.board.materialId !== oldId) return node
    if (layers) assertTreeNodeEditable(root, node.id, layers)
    changed = true
    return { ...node, board: { ...node.board, materialId: newId } }
  }
  const result = replace(root)
  return changed ? result as GroupNode : root
}

/** Whole-project «Замена»: canonical cabinet config және еркін board бірге өзгереді. */
export function replaceTreeMaterial(root: GroupNode, oldId: string, newId: string, layers?: Layer[]): GroupNode {
  const replace = (node: SceneNode): SceneNode => {
    if (node.kind === 'group') {
      const children = node.children.map(replace)
      return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node
    }
    if (node.kind === 'board') {
      if (node.board.materialId !== oldId) return node
      if (layers) assertTreeNodeEditable(root, node.id, layers)
      return { ...node, board: { ...node.board, materialId: newId } }
    }
    if (node.kind === 'cabinet') {
      const config = applyMaterialReplace([node.config], oldId, newId, { kind: 'all' })[0]!
      if (JSON.stringify(config) === JSON.stringify(node.config)) return node
      if (layers) assertTreeNodeEditable(root, node.id, layers)
      return { ...node, config }
    }
    return node
  }
  return replace(root) as GroupNode
}
