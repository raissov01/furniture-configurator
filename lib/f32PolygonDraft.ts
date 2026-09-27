import { parseNumberDraft } from '@/lib/numberDraft'
import { validatePolygonContour } from '@/src/core/polygon'
import type { PolygonContourInput } from '@/src/core/polygon'
import type { BoardSpec } from '@/src/core/tree'
import type { Catalog } from '@/src/core/types'

export type PolygonPointDraft = { x: string; y: string }

export function polygonDraftResult(
  points: readonly PolygonPointDraft[], bandIds: readonly string[],
  length: number, width: number, catalog: Catalog,
): { contour: PolygonContourInput; error?: never } | { error: string; contour?: never } {
  const parsed: PolygonContourInput['points'] = []
  for (const [index, point] of points.entries()) {
    for (const axis of ['x', 'y'] as const) {
      const max = axis === 'x' ? length : width
      const result = parseNumberDraft(point[axis], { min: 0, max, integer: true })
      if (result.value === undefined) {
        return { error: `contour.points[${index}].${axis}: бүтін мм, рұқсат 0..${max}` }
      }
    }
    parsed.push({ x: Number(point.x), y: Number(point.y) })
  }
  if (bandIds.length !== points.length) {
    return { error: `contour.bands: рұқсат ${points.length} кесіндіге ${points.length} кромка` }
  }
  for (const [index, id] of bandIds.entries()) {
    if (id && !catalog.edgeBands.some((band) => band.id === id)) {
      return { error: `contour.bands[${index}]: кромка каталогта жоқ` }
    }
  }
  const contour: PolygonContourInput = { points: parsed,
    bands: bandIds.map((id) => id ? { bandId: id } : null) }
  try { validatePolygonContour(contour, length, width, 'contour') }
  catch (cause) { return { error: cause instanceof Error ? cause.message : 'contour: жарамсыз контур' } }
  return { contour }
}

export function polygonCommitResult(board: BoardSpec, contour: PolygonContourInput):
  { patch: Partial<BoardSpec>; error?: never } | { error: string; patch?: never } {
  if (Object.values(board.edges).some(Boolean)) {
    return { error: 'edges: контур үшін төрт тікбұрыш жиегіндегі кромканы алып тастаңыз' }
  }
  if (board.cutouts?.length) return { error: 'cutouts: контур үшін ойықтарды алдымен өшіріңіз' }
  if (board.corners) return { error: 'corners: контур үшін бұрыш дөңгелектеуін алдымен өшіріңіз' }
  try { validatePolygonContour(contour, board.length, board.width, 'contour') }
  catch (cause) { return { error: cause instanceof Error ? cause.message : 'contour: жарамсыз контур' } }
  return { patch: { contour } }
}
