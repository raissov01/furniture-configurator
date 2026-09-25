/**
 * Ағашқа негізделген жоба файлының v4 пішіні.
 *
 * UI әзірше v3 cabinets/placements сақтайды. Бұл модуль v4-ті таза өзекте
 * оқып, миграциялайды; UI көшкенде сол бір root-ты сақтау жолына жалғайды.
 */
import { z } from 'zod'
import { HINGE_CUP_DEPTH } from './constants'
import {
  CabinetConfigSchema, ConstructionSettingsSchema, EdgeBandSchema,
  MaterialSchema, PriceOverridesSchema, ProjectInfoSchema, ProjectLayersSchema,
  RoomSchema, parseProjectWithLayers,
} from './schema'
import { createDefaultLayer, isNodeHiddenByLayer } from './layers'
import { SceneLightsSchema } from './visual'
import { IDENTITY_TRANSFORM } from './tree'
import { treeFromProject } from './treeFromProject'
import type { BoardSpec, GroupNode, SceneNode } from './tree'
import type { Layer } from './layers'
import type { CabinetConfig, ProjectFile } from './types'
import type { SceneLight } from './visual'

/** v4-те корпус конфигінің жалғыз орны — root ішіндегі CabinetNode. */
export type ProjectFileV4 = Omit<ProjectFile, 'schemaVersion' | 'cabinets' | 'placements'> & {
  schemaVersion: 4
  root: GroupNode
  layers?: Layer[] | undefined
  lights: SceneLight[]
}

const mm = z.number().int()
const positiveMm = mm.positive()
const vec3 = z.strictObject({ x: mm, y: mm, z: mm })
const transform = z.strictObject({
  pos: vec3,
  // composePose тек Y бұрылысын есептейді; X/Z мәнін қабылдау сақталған
  // жобаны ашқанда ғана кейінгі runtime қатесіне әкелер еді.
  rot: z.strictObject({ x: z.literal(0), y: z.number(), z: z.literal(0) }),
})
const edge = z.strictObject({ bandId: z.string().min(1) }).nullable()
const cutoutBase = { id: z.string().min(1), label: z.string().optional(),
  corner: z.enum(['bottomLeft', 'bottomRight', 'topLeft', 'topRight']), x: mm, y: mm }
const cutout = z.discriminatedUnion('shape', [
  z.strictObject({ shape: z.literal('rect'), ...cutoutBase,
    width: positiveMm, height: positiveMm, radius: mm.nonnegative().optional() }),
  z.strictObject({ shape: z.literal('circle'), ...cutoutBase, diameter: positiveMm }),
])

const board: z.ZodType<BoardSpec> = z.strictObject({
  materialId: z.string().min(1),
  length: positiveMm,
  width: positiveMm,
  orientation: z.strictObject({
    length: z.enum(['x', 'y', 'z']), width: z.enum(['x', 'y', 'z']),
    thickness: z.enum(['x', 'y', 'z']),
  }).refine((o) => ['yzx', 'xzy', 'yxz', 'xyz'].includes(`${o.length}${o.width}${o.thickness}`), {
    message: 'rotationFor қолдайтын төрт бағдардың бірі қажет',
  }),
  edges: z.strictObject({ L1: edge, L2: edge, W1: edge, W2: edge }),
  grainAlongLength: z.boolean(),
  veneerGroup: z.string().min(1).refine((value) => value.trim() === value && value.length > 0, {
    message: 'veneerGroup бос емес, шеттерінде бос орынсыз болуы керек',
  }).optional(),
  role: z.enum([
    'side', 'top', 'bottom', 'shelf', 'divider', 'back', 'front',
    'drawerSide', 'drawerBack', 'drawerBottom', 'plinth', 'rail', 'custom',
  ]),
  drilling: z.array(z.strictObject({
    face: z.enum(['inner', 'outer', 'edgeL1', 'edgeL2', 'edgeW1', 'edgeW2']),
    x: mm, y: mm, diameter: positiveMm,
    // CLAUDE.md §0.2: cup тереңдігі 12.5 мм — жалғыз бөлшек drill өлшемі.
    depth: z.union([positiveMm, z.literal(HINGE_CUP_DEPTH)]),
    purpose: z.enum(['confirmat', 'dowel', 'minifix', 'shelfPin', 'hinge',
      'runner', 'handle', 'leg', 'facadeScrew']),
    hardwareId: z.string().min(1).optional(),
  }).refine((drill) => drill.depth !== HINGE_CUP_DEPTH || drill.purpose === 'hinge', {
    message: `${HINGE_CUP_DEPTH} мм тереңдік тек ілгек cup үшін`,
  })).optional(),
  cutouts: z.array(cutout).optional(),
  corners: z.strictObject({
    bottomLeft: mm.nonnegative(), bottomRight: mm.nonnegative(),
    topRight: mm.nonnegative(), topLeft: mm.nonnegative(),
  }).optional(),
  milling: z.array(z.strictObject({
    points: z.array(z.strictObject({ x: mm, y: mm })), closed: z.boolean(),
  })).optional(),
})

const baseNode = {
  id: z.string().min(1), name: z.string().min(1), transform,
  hidden: z.boolean().optional(), locked: z.boolean().optional(),
  layerId: z.string().min(1).optional(),
}

/** Рекурсивті discriminated union: v4 JSON-ның төрт түйіні толық тексеріледі. */
export const SceneNodeSchema: z.ZodType<SceneNode> = z.lazy(() => z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('group'), ...baseNode, children: z.array(SceneNodeSchema) }),
  z.strictObject({ kind: z.literal('cabinet'), ...baseNode, config: CabinetConfigSchema }),
  z.strictObject({ kind: z.literal('board'), ...baseNode, board }),
  z.strictObject({ kind: z.literal('solid'), ...baseNode,
    solid: z.strictObject({ size: z.strictObject({ x: positiveMm, y: positiveMm, z: positiveMm }),
      color: z.string().optional(), textureId: z.string().optional() }),
  }),
]))

export const ProjectFileV4Schema: z.ZodType<ProjectFileV4> = z.strictObject({
  schemaVersion: z.literal(4),
  name: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  edgeBands: z.array(EdgeBandSchema),
  settings: ConstructionSettingsSchema.optional(),
  room: RoomSchema,
  info: ProjectInfoSchema.optional(),
  priceOverrides: PriceOverridesSchema.optional(),
  layers: ProjectLayersSchema.optional(),
  lights: SceneLightsSchema.default([]),
  root: SceneNodeSchema.refine((node): node is GroupNode => node.kind === 'group', {
    message: 'root түйіні group болуы керек',
  }),
}).superRefine((project, context) => {
  const ids = new Set<string>()
  const visit = (node: SceneNode, path: (string | number)[]): void => {
    if (ids.has(node.id)) {
      context.addIssue({ code: 'custom', path: ['root', ...path, 'id'],
        message: `Қайталанған түйін id: ${node.id}` })
    }
    ids.add(node.id)
    if (node.kind === 'group') {
      node.children.forEach((child, index) => visit(child, [...path, 'children', index]))
    }
  }
  visit(project.root, [])
})

export const CURRENT_TREE_SCHEMA_VERSION = 4

/**
 * Ескі UI орны жоқ шкафты сахнаға қоспайды. Оны мүлде тастау конфигті
 * жоғалтады; hidden түйін барлық деректі сақтап, ескі есеп нәтижесін ұстайды.
 */
export function migrateV3ToV4(project: ProjectFile & { layers?: Layer[] }): ProjectFileV4 {
  const root = treeFromProject(project)
  // v3-те `root` деген кабинет id-і заңды. Жаңа түбір оның id-ін баспасын.
  const cabinetIds = new Set(project.cabinets.map((cabinet) => cabinet.id))
  while (cabinetIds.has(root.id)) root.id = `${root.id}-1`
  // Орны жоқ шкаф соңына қосылмайды, өз орнына қойылады: ретке белсенді
  // модуль (`cabinets[0]`) мен деталировка нөмірлері сүйенеді.
  const placed = new Map(root.children.map((node) => [node.id, node]))
  root.children = project.cabinets.map((cabinet) => placed.get(cabinet.id) ?? {
    kind: 'cabinet', id: cabinet.id, name: cabinet.name, hidden: true,
    transform: IDENTITY_TRANSFORM, config: cabinet,
  })
  const { cabinets: _cabinets, placements: _placements, schemaVersion: _version, ...rest } = project
  return { ...rest, layers: rest.layers?.length ? rest.layers : [createDefaultLayer()], lights: [], schemaVersion: 4, root }
}

/** v1–v3 оқығанда бұрынғы миграция тізбегі қолданылады; v4 тура тексеріледі. */
export function parseProjectV4(raw: unknown): ProjectFileV4 {
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion
  if (version === 4) return ProjectFileV4Schema.parse(raw)
  const legacy = parseProjectWithLayers(raw)
  return ProjectFileV4Schema.parse(migrateV3ToV4(legacy))
}

/**
 * Цехқа баратын шкафтар: `flattenTree`-дің ережесімен — түйіннің өзі, оның
 * топтарының бірі не қабаты жасырын болса, шкаф алынбайды. Ағаштағы ретпен.
 * CLI (`cutlist`, `export`) шкаф бойынша жұмыс істейді; еркін тақталар
 * (`board`) мұнда кірмейді.
 */
export function productionCabinets(project: ProjectFileV4): CabinetConfig[] {
  const result: CabinetConfig[] = []
  const layers = project.layers ?? []
  const step = (node: SceneNode): void => {
    // Түбір қабатқа жатпайды (`flattenTree`-мен бірдей ереже).
    if (node.hidden === true || (node !== project.root && isNodeHiddenByLayer(node, layers))) return
    if (node.kind === 'cabinet') {
      result.push(node.config.id === node.id ? node.config : { ...node.config, id: node.id })
    } else if (node.kind === 'group') {
      node.children.forEach(step)
    }
  }
  step(project.root)
  return result
}
