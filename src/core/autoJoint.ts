/** Екі еркін тақтаның бет–торц түйініне арналған таза присадка ұсынысы. */
import { mergeSettings } from './constants'
import { confirmatJoint, minifixJoint } from './drilling'
import { ConfigValidationError } from './errors'
import { panelBox } from './geometry'
import type { FlatNode, FlatScene } from './flatten'
import type { Catalog, Drill, Panel, SettingsOverride } from './types'

export type AutoJointKind = 'confirmat' | 'minifix' | 'dowel'
export type AutoJointResult = { boardId: string; drilling: Drill[] }

type Candidate = { face: Panel; edge: Panel }

function overlap(a: [number, number], b: [number, number]): number {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0])
}

function candidate(face: Panel, edge: Panel, faceT: number, edgeT: number, tolerance: number): boolean {
  const axis = face.orientation.thickness
  if (axis === edge.orientation.thickness) return false
  const fb = panelBox(face, faceT)
  const eb = panelBox(edge, edgeT)
  const touches = Math.abs(eb.min[axis] - fb.max[axis]) <= tolerance
    || Math.abs(eb.max[axis] - fb.min[axis]) <= tolerance
  if (!touches) return false
  for (const other of ['x', 'y', 'z'] as const) {
    if (other === axis) continue
    const shared = overlap([fb.min[other], fb.max[other]], [eb.min[other], eb.max[other]])
    if (shared <= 0) return false
    if (other === edge.orientation.thickness && shared < edgeT - tolerance) return false
  }
  return true
}

function placedBoard(node: FlatNode): Panel {
  if (node.panels.length !== 1) throw new ConfigValidationError('boardIds', `${node.nodeId}: бір еркін тақта күтіледі`, 'екі board түйіні')
  if (node.pose.rotationY !== 0) throw new ConfigValidationError('transform.rot.y',
    `${node.nodeId}: бұрылған тақтаға автоматты присадка әлі қолдау таппайды`, '0°')
  const panel = node.panels[0]!
  if (panel.cutouts.length > 0 || panel.milling.length > 0 || panel.corners) {
    throw new ConfigValidationError('board.geometry', `${node.nodeId}: оймасы не дөңгелек бұрышы бар тақта`, 'тікбұрышты тақта')
  }
  return {
    ...panel,
    position: {
      x: panel.position.x + node.pose.position.x,
      y: panel.position.y + node.pose.position.y,
      z: panel.position.z + node.pose.position.z,
    },
    drilling: [],
  }
}

function drillFits(panel: Panel, hole: Drill, thickness: number): boolean {
  const radius = hole.diameter / 2
  const face = hole.face === 'inner' || hole.face === 'outer'
  const edgeOnLength = hole.face === 'edgeW1' || hole.face === 'edgeW2'
  const along = face ? panel.cutLength : edgeOnLength ? panel.cutWidth : panel.cutLength
  const across = face ? panel.cutWidth : thickness
  const depthLimit = face ? thickness : edgeOnLength ? panel.cutLength : panel.cutWidth
  return hole.x >= radius && hole.x <= along - radius
    && hole.y >= radius && hole.y <= across - radius
    && hole.depth > 0 && hole.depth <= depthLimit
}

/** Жоба конфигін өзгертпейді; екі тақтаның тек жаңа Drill[] тізімін қайтарады. */
export function autoJoint(
  scene: FlatScene,
  boardIds: [string, string],
  kind: AutoJointKind,
  catalog: Catalog,
  settings?: SettingsOverride,
  tolerance = 0,
): AutoJointResult[] {
  // Шкант артикулының жалпы тақтаға арналған Ø/тереңдігі ShopProfile-де жоқ.
  // DRAWER_BOTTOM_DOWEL_* тек ящик түбінің ережесі, оны мұнда көшіру қауіпті.
  if (kind === 'dowel') throw new ConfigValidationError('joint.kind',
    'шканттың нақты артикулы және екі тақтадағы тесік тереңдігі цехта бапталмаған',
    'артикул бапталғанша қолмен DrillEditor-де қою')
  if (!Number.isSafeInteger(tolerance) || tolerance < 0) {
    throw new ConfigValidationError('tolerance', `${tolerance} мм`, 'бүтін мм ≥ 0')
  }
  if (boardIds[0] === boardIds[1]) throw new ConfigValidationError('boardIds', 'екі бөлек тақта таңдаңыз', '2 board id')
  const nodes = boardIds.map((id) => scene.nodes.find((n) => n.nodeId === id))
  if (nodes.some((node) => !node)) throw new ConfigValidationError('boardIds', 'тақта табылмады', '2 көрінетін board id')
  const [first, second] = nodes.map((node) => placedBoard(node!)) as [Panel, Panel]
  const materials = new Map(catalog.materials.map((material) => [material.id, material.thickness]))
  const thickness = (panel: Panel): number => {
    const value = materials.get(panel.materialId)
    if (value === undefined) throw new ConfigValidationError('materialId', `${panel.materialId}: материал табылмады`)
    return value
  }
  const pairs: Candidate[] = []
  if (candidate(first, second, thickness(first), thickness(second), tolerance)) pairs.push({ face: first, edge: second })
  if (candidate(second, first, thickness(second), thickness(first), tolerance)) pairs.push({ face: second, edge: first })
  if (pairs.length !== 1) throw new ConfigValidationError('boardIds',
    pairs.length === 0 ? 'тақталардың беті мен торцы жанаспайды' : 'бет пен торцтың екіұшты жанасуы',
    'бір анық бет–торц түйіні')

  const ctx = { thickness, bands: new Map(catalog.edgeBands.map((band) => [band.id, band])), settings: mergeSettings(settings) }
  const pair = pairs[0]!
  if (kind === 'minifix') minifixJoint(pair.edge, pair.face, ctx)
  else if (kind === 'confirmat') confirmatJoint(pair.face, pair.edge, ctx)
  else throw new ConfigValidationError('joint.kind', `${kind}: бекіткіш түрі белгісіз`, 'confirmat | minifix')
  if (first.drilling.length === 0 || second.drilling.length === 0) {
    throw new ConfigValidationError('joint.length', 'таңдалған бекіткіш буынға сыймады', 'екі тақтада да тесік бар буын')
  }
  for (const panel of [first, second]) {
    for (const hole of panel.drilling) if (!drillFits(panel, hole, thickness(panel))) {
      throw new ConfigValidationError('joint.geometry', `${panel.id}: Ø${hole.diameter} тесігі тақтаға сыймады`, 'тесік толық рез материалдың ішінде')
    }
  }
  return [first, second].map((panel, index) => ({ boardId: boardIds[index]!, drilling: panel.drilling }))
}
