/** Сақталған еркін тақта буындарын өзгерген геометриядан қайта есептеу. */
import { autoJoint, validateJointDrill } from './autoJoint'
import type { AutoJointKind, AutoJointResult } from './autoJoint'
import { ConfigValidationError } from './errors'
import { flattenTree } from './flatten'
import type { Layer } from './layers'
import type { ProjectFileV4 } from './projectV4'
import { IDENTITY_TRANSFORM, findNode, walkTree } from './tree'
import type { BoardNode, GroupNode } from './tree'
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

function rejectManualConflict(root: GroupNode, results: readonly AutoJointResult[]): void {
  for (const result of results) {
    const node = findNode(root, result.boardId)
    if (node?.kind !== 'board') continue
    const collides = (node.board.drilling ?? []).some((manual) => result.drilling.some((generatedHole) =>
      manual.face === generatedHole.face && manual.x === generatedHole.x && manual.y === generatedHole.y))
    if (collides) throw new ConfigValidationError(`board[${result.boardId}].drilling`,
      'қол тесігі автоматты буын тесігімен бір орында', 'қол тесігін жылжытыңыз не буынды алып тастаңыз')
  }
}

/** Алғашқы буын: бет пен торц нақты анықталғаннан кейін ғана сақталады. */
export function createAutoJoint(
  root: GroupNode, boardIds: [string, string], kind: AutoJointKind,
  catalog: Catalog, settings?: SettingsOverride, tolerance = 0, id = `joint-${boardIds.join('-')}`,
  layers?: Layer[], edited = false,
): AutoJointRecord {
  const drilling = generated(root, boardIds, kind, catalog, settings, tolerance, layers)
  rejectManualConflict(root, drilling)
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
      rejectManualConflict(root, drilling)
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
  root: GroupNode, catalog: Catalog, settings?: SettingsOverride, _layers?: Layer[],
): void {
  const boards: BoardNode[] = []
  // Check each board independently. Hidden boards still need valid CNC data;
  // an unrelated invalid board is reported by the production view instead.
  walkTree(root, (node) => {
    if (node.kind === 'board' && (node.board.drilling?.length ?? 0) > 0) boards.push(node)
  })
  const materials = new Map(catalog.materials.map((item) => [item.id, item.thickness]))
  for (const board of boards) {
    const isolated: GroupNode = { kind: 'group', id: 'manual-drill-validation', name: 'manual-drill-validation',
      transform: IDENTITY_TRANSFORM, children: [{ ...board, hidden: false, layerId: undefined,
        transform: IDENTITY_TRANSFORM }] }
    const panel = flattenTree(isolated, catalog, settings).nodes[0]!.panels[0]!
    const thickness = materials.get(panel.materialId)
    if (thickness === undefined) throw new ConfigValidationError(`board[${board.id}].materialId`, 'материал табылмады')
    panel.drilling.forEach((hole, index) => validateJointDrill(panel, hole, thickness,
      `board[${board.id}].drilling.${index}`))
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
    joints = joints.map((item) => item.id === change.joint!.id
      ? { ...item, kind: change.joint!.kind, edited: item.edited || item.kind !== change.joint!.kind }
      : item)
  }
  return { ...project, root, materials, edgeBands, settings, layers,
    autoJoints: rebuildAutoJoints(root, joints, catalog, settings, layers) }
}
