/** Сақталған еркін тақта буындарын өзгерген геометриядан қайта есептеу. */
import { autoJoint, validateJointDrill } from './autoJoint'
import type { AutoJointKind, AutoJointResult } from './autoJoint'
import { ConfigValidationError } from './errors'
import { flattenTree } from './flatten'
import type { Layer } from './layers'
import type { ProjectFileV4 } from './projectV4'
import { walkTree } from './tree'
import type { GroupNode } from './tree'
import type { Catalog, SettingsOverride } from './types'

export type AutoJointRecord = {
  id: string
  boardIds: [string, string]
  faceBoardId: string
  edgeBoardId: string
  kind: AutoJointKind
  tolerance: number
  edited: boolean
  status: 'valid' | 'broken'
  drilling: AutoJointResult[]
  error?: { field: string; message: string } | undefined
}

function generated(
  root: GroupNode, boardIds: [string, string], kind: AutoJointKind,
  catalog: Catalog, settings: SettingsOverride | undefined, tolerance: number,
  layers?: Layer[],
): AutoJointResult[] {
  return autoJoint(flattenTree(root, catalog, settings, layers), boardIds, kind, catalog, settings, tolerance)
}

/** Алғашқы буын: бет пен торц нақты анықталғаннан кейін ғана сақталады. */
export function createAutoJoint(
  root: GroupNode, boardIds: [string, string], kind: AutoJointKind,
  catalog: Catalog, settings?: SettingsOverride, tolerance = 0, id = `joint-${boardIds.join('-')}`,
  layers?: Layer[], edited = false,
): AutoJointRecord {
  const drilling = generated(root, boardIds, kind, catalog, settings, tolerance, layers)
  const face = drilling.find((item) => item.drilling.some((hole) => hole.face === 'inner' || hole.face === 'outer'))
  const edge = drilling.find((item) => item.boardId !== face?.boardId)
  if (!face || !edge) throw new ConfigValidationError('joint.geometry', 'бет пен торц табылмады')
  return { id, boardIds, faceBoardId: face.boardId, edgeBoardId: edge.boardId,
    kind, tolerance, edited, status: 'valid', drilling }
}

/** Қате буын да тізімде қалады: цехқа қате тесік кетпейді, UI ескертуді көрсете алады. */
export function rebuildAutoJoints(
  root: GroupNode, joints: readonly AutoJointRecord[], catalog: Catalog,
  settings?: SettingsOverride, layers?: Layer[],
): AutoJointRecord[] {
  return joints.map((joint) => {
    try {
      const drilling = generated(root, joint.boardIds, joint.kind, catalog, settings, joint.tolerance, layers)
      const face = drilling.find((item) => item.drilling.some((hole) => hole.face === 'inner' || hole.face === 'outer'))
      if (face?.boardId !== joint.faceBoardId) {
        throw new ConfigValidationError('joint.faceBoardId', 'буынның бет тақтасы өзгерді', joint.faceBoardId)
      }
      return { ...joint, status: 'valid' as const, drilling, error: undefined }
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      return { ...joint, status: 'broken' as const, drilling: [],
        error: { field: error.field === 'boardIds' ? 'joint.boardIds' : error.field,
          message: error.message } }
    }
  })
}

export type AutoJointChange = {
  root?: GroupNode
  materials?: Catalog['materials']
  edgeBands?: Catalog['edgeBands']
  settings?: SettingsOverride
  layers?: Layer[]
  create?: { id: string; boardIds: [string, string]; kind: AutoJointKind; tolerance?: number; edited?: boolean }
  joint?: { id: string; kind: AutoJointKind }
}

/** Қол тесіктерін де нақты рез панель шегімен салыстырады. */
export function validateManualBoardDrilling(
  root: GroupNode, catalog: Catalog, settings?: SettingsOverride, layers?: Layer[],
): void {
  const boardIds = new Set<string>()
  // Parsing a project must not force a manufacturing render of boards without
  // manual holes. The production view reports their geometry errors itself.
  walkTree(root, (node) => {
    if (node.kind === 'board' && (node.board.drilling?.length ?? 0) > 0) boardIds.add(node.id)
  })
  if (boardIds.size === 0) return
  const materials = new Map(catalog.materials.map((item) => [item.id, item.thickness]))
  for (const node of flattenTree(root, catalog, settings, layers).nodes) {
    if (!boardIds.has(node.nodeId)) continue
    const panel = node.panels[0]
    if (!panel) continue
    const thickness = materials.get(panel.materialId)
    if (thickness === undefined) throw new ConfigValidationError(`board[${node.nodeId}].materialId`, 'материал табылмады')
    panel.drilling.forEach((hole, index) => validateJointDrill(panel, hole, thickness,
      `board[${node.nodeId}].drilling.${index}`))
  }
}

/** Store оқиғаларына жалғыз кіріс: нәтиже бір history/undo қадамына салынады. */
export function applyAutoJointChange(project: ProjectFileV4, change: AutoJointChange): ProjectFileV4 {
  const root = change.root ?? project.root
  const materials = change.materials ?? project.materials
  const edgeBands = change.edgeBands ?? project.edgeBands
  const settings = change.settings ?? project.settings
  const layers = change.layers ?? project.layers
  const catalog = { materials, edgeBands }
  validateManualBoardDrilling(root, catalog, settings, layers)
  let joints = project.autoJoints ?? []
  if (change.create) {
    if (joints.some((item) => item.id === change.create!.id)) {
      throw new ConfigValidationError('joint.id', 'буын id қайталанды', 'бірегей id')
    }
    const next = createAutoJoint(root, change.create.boardIds, change.create.kind, catalog,
      settings, change.create.tolerance ?? 0, change.create.id, layers, change.create.edited ?? false)
    joints = [...joints, next]
  }
  if (change.joint) {
    if (!joints.some((item) => item.id === change.joint!.id)) {
      throw new ConfigValidationError('joint.id', 'буын табылмады', 'бар id')
    }
    joints = joints.map((item) => item.id === change.joint!.id ? { ...item, kind: change.joint!.kind } : item)
  }
  return { ...project, root, materials, edgeBands, settings, layers,
    autoJoints: rebuildAutoJoints(root, joints, catalog, settings, layers) }
}
