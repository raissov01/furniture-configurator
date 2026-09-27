/** Еркін тақта/декор тобының ата кеңістігіндегі X жазықтығына қатысты айна көшірмесі. */
import { mergeSettings } from './constants'
import { nextMirrorName } from './mirrorName'
import { calculateCutDimensions } from './edges'
import { ConfigValidationError } from './errors'
import type { BoardSpec, SceneNode } from './tree'
import type { Catalog, Drill, SettingsOverride } from './types'

function exact(value: number, field: string): number {
  const rounded = Math.round(value)
  if (!Number.isSafeInteger(rounded) || Math.abs(value - rounded) > 1e-7) {
    throw new ConfigValidationError(field, 'айнадан кейін орын бүтін мм емес', '90°-қа еселі бұрылыс және бүтін мм')
  }
  return rounded === 0 ? 0 : rounded
}

function mirrorDrill(drill: Drill, axis: 'length' | 'width' | 'thickness', cutLength: number, cutWidth: number, thickness: number): Drill {
  const out = { ...drill }
  if (axis === 'length') {
    if (out.face === 'edgeW1') out.face = 'edgeW2'
    else if (out.face === 'edgeW2') out.face = 'edgeW1'
    if (out.face === 'inner' || out.face === 'outer' || out.face === 'edgeL1' || out.face === 'edgeL2') out.x = cutLength - out.x
  } else if (axis === 'width') {
    if (out.face === 'edgeL1') out.face = 'edgeL2'
    else if (out.face === 'edgeL2') out.face = 'edgeL1'
    if (out.face === 'inner' || out.face === 'outer') out.y = cutWidth - out.y
    else if (out.face === 'edgeW1' || out.face === 'edgeW2') out.x = cutWidth - out.x
  } else {
    if (out.face === 'inner') out.face = 'outer'
    else if (out.face === 'outer') out.face = 'inner'
    else out.y = thickness - out.y
  }
  return out
}

function mirrorBoard(board: BoardSpec, catalog: Catalog, settings?: SettingsOverride): { board: BoardSpec; spanX: number } {
  if (board.contour || board.corners || board.cutouts?.length || board.milling?.length) {
    throw new ConfigValidationError('board', 'ойма/контур/фрезерлеу бар тақтаның айнасы әзірге есептелмейді', 'тікбұрышты тақта, тек кромка мен тесік')
  }
  const material = catalog.materials.find((item) => item.id === board.materialId)
  if (!material) throw new ConfigValidationError('board.materialId', `материал табылмады: ${board.materialId}`)
  const bands = new Map(catalog.edgeBands.map((item) => [item.id, item]))
  const { cutLength, cutWidth } = calculateCutDimensions(board.length, board.width, board.edges, bands, mergeSettings(settings))
  const axis = board.orientation.length === 'x' ? 'length'
    : board.orientation.width === 'x' ? 'width' : 'thickness'
  const edges = axis === 'length'
    ? { ...board.edges, W1: board.edges.W2, W2: board.edges.W1 }
    : axis === 'width'
      ? { ...board.edges, L1: board.edges.L2, L2: board.edges.L1 }
      : { ...board.edges }
  return {
    board: { ...board, edges,
      ...(board.drilling ? { drilling: board.drilling.map((drill) => mirrorDrill(drill, axis, cutLength, cutWidth, material.thickness)) } : {}) },
    spanX: axis === 'length' ? board.length : axis === 'width' ? board.width : material.thickness,
  }
}

/**
 * `planeX` таңдалған түйіннің АТАСЫНА қатысты. Түбірге берілгенде әлем X-і.
 * Жаңа id-лер `idSuffix` арқылы жасалады; шақырушы қайталанбауын тексереді.
 * Шкафты мұнда араластырмаймыз: оның айнасы бөлек параметрлік ережемен жүреді.
 */
export function mirrorFreeNodeX(node: SceneNode, catalog: Catalog, planeX: number, idSuffix: string,
  settings?: SettingsOverride): SceneNode {
  if (!Number.isSafeInteger(planeX)) throw new ConfigValidationError('planeX', 'айна жазықтығы бүтін мм болуы керек', 'бүтін мм')
  if (!idSuffix) throw new ConfigValidationError('idSuffix', 'көшірме id-і үшін жұрнақ керек', 'бос емес жол')
  const mirror = (source: SceneNode, plane: number): SceneNode => {
    if (source.kind === 'cabinet') throw new ConfigValidationError('node.kind', 'шкафтың айнасы бөлек есептеледі', 'board | solid | group')
    const payload = source.kind === 'board' ? mirrorBoard(source.board, catalog, settings) : null
    const spanX = source.kind === 'solid' ? source.solid.size.x : payload?.spanX ?? 0
    const angle = source.transform.rot.y * Math.PI / 180
    const transform = {
      pos: {
        x: exact(2 * plane - source.transform.pos.x - spanX * Math.cos(angle), 'transform.pos.x'),
        y: source.transform.pos.y,
        z: exact(source.transform.pos.z - spanX * Math.sin(angle), 'transform.pos.z'),
      },
      rot: { ...source.transform.rot, y: -source.transform.rot.y },
    }
    const common = { ...source, id: `${source.id}${idSuffix}`, name: nextMirrorName(source.name), transform }
    if (source.kind === 'board') return { ...common, kind: 'board', board: payload!.board }
    if (source.kind === 'solid') return { ...common, kind: 'solid', solid: structuredClone(source.solid) }
    if (source.kind === 'annotation') return { ...common, kind: 'annotation', annotation: structuredClone(source.annotation) }
    return { ...common, kind: 'group', children: source.children.map((child) => mirror(child, 0)) }
  }
  return mirror(node, planeX)
}
