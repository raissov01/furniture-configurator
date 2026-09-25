import { describe, expect, it } from 'vitest'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, ORIENT_UPRIGHT, SEED_CATALOG } from '../src/core/index'
import { boardDimensions, resizeBoard } from '../src/core/boardProperties'
import type { BoardSpec } from '../src/core/tree'

const board = (orientation: BoardSpec['orientation']): BoardSpec => ({
  materialId: SEED_CATALOG.materials[0]!.id, length: 600, width: 400,
  orientation, role: 'custom', grainAlongLength: false,
  edges: { L1: null, L2: null, W1: null, W2: null },
})
const material = SEED_CATALOG.materials[0]!

describe('еркін тақтаның H × W × D габариті', () => {
  it('төрт бағдарда үшінші ось материал қалыңдығынан шығады', () => {
    expect(boardDimensions(board(ORIENT_FACING), material)).toEqual({ height: 600, width: 400, depth: material.thickness })
    expect(boardDimensions(board(ORIENT_SIDE), material)).toEqual({ height: 600, width: material.thickness, depth: 400 })
    expect(boardDimensions(board(ORIENT_HORIZONTAL), material)).toEqual({ height: material.thickness, width: 600, depth: 400 })
    expect(boardDimensions(board(ORIENT_UPRIGHT), material)).toEqual({ height: 400, width: 600, depth: material.thickness })
  })

  it('жұмыс осін ғана өзгертеді; материал қалыңдығын екінші ақиқат көзі етпейді', () => {
    expect(resizeBoard(board(ORIENT_FACING), material, 'height', 700).length).toBe(700)
    expect(resizeBoard(board(ORIENT_FACING), material, 'width', 500).width).toBe(500)
    expect(() => resizeBoard(board(ORIENT_FACING), material, 'depth', 20)).toThrow(/depth|D|қалың/)
    expect(() => resizeBoard(board(ORIENT_SIDE), material, 'height', 700.5)).toThrow(/бүтін/)
  })
})
