/** Өлшем өрісінің көрсету реті H × W × D; тақта қалыңдығы материалдікі. */
import { ConfigValidationError } from './errors'
import type { BoardSpec } from './tree'
import type { Axis, Material } from './types'

export type BoardDimension = 'height' | 'width' | 'depth'
const axis: Record<BoardDimension, Axis> = { height: 'y', width: 'x', depth: 'z' }

export function boardDimensions(board: BoardSpec, material: Material): Record<BoardDimension, number> {
  const dimension = (target: Axis): number => {
    if (board.orientation.length === target) return board.length
    if (board.orientation.width === target) return board.width
    return material.thickness
  }
  return { height: dimension('y'), width: dimension('x'), depth: dimension('z') }
}

export function resizeBoard(board: BoardSpec, material: Material, dimension: BoardDimension, value: number): BoardSpec {
  const target = axis[dimension]
  if (board.orientation.thickness === target) {
    throw new ConfigValidationError(`board.${dimension}`, 'бұл осьтің қалыңдығы материалдан алынады', 'материалды таңдаңыз')
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ConfigValidationError(`board.${dimension}`, 'өлшем оң бүтін мм болуы керек', 'бүтін мм > 0')
  }
  return board.orientation.length === target ? { ...board, length: value } : { ...board, width: value }
}
