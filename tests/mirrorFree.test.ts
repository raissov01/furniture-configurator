import { describe, expect, it } from 'vitest'
import { mirrorFreeNodeX } from '../src/core/mirrorFree'
import { IDENTITY_TRANSFORM, walkTree } from '../src/core/tree'
import type { BoardNode, GroupNode } from '../src/core/tree'
import { SEED_CATALOG } from '../src/core/seed'

const material = SEED_CATALOG.materials.find((entry) => entry.thickness === 16)!
const band = SEED_CATALOG.edgeBands.find((entry) => entry.thickness === 2)!
const board = (): BoardNode => ({
  kind: 'board', id: 'b', name: 'Тақта', transform: { pos: { x: 10, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
  board: { materialId: material.id, length: 600, width: 200,
    orientation: { length: 'y', width: 'x', thickness: 'z' }, role: 'custom', grainAlongLength: false,
    edges: { L1: { bandId: band.id }, L2: null, W1: null, W2: null },
    drilling: [
      { face: 'inner', x: 128, y: 64, diameter: 8, depth: 16, purpose: 'confirmat' },
      { face: 'edgeW1', x: 50, y: 8, diameter: 5, depth: 35, purpose: 'confirmat' },
      { face: 'edgeL1', x: 128, y: 8, diameter: 5, depth: 35, purpose: 'confirmat' },
    ],
  },
})

describe('еркін тақта мен топтың X айнасы', () => {
  it('топ ішіндегі аннотацияны айнаға көшіреді', () => {
    const group: GroupNode = { kind: 'group', id: 'g', name: 'Топ', transform: structuredClone(IDENTITY_TRANSFORM),
      children: [{ kind: 'annotation', id: 'a', name: 'Белгі', transform: structuredClone(IDENTITY_TRANSFORM),
        annotation: { text: 'A', fontSize: 16, color: '#000000' } }] }
    const mirrored = mirrorFreeNodeX(group, SEED_CATALOG, 500, '-m')
    expect(mirrored.kind).toBe('group')
    if (mirrored.kind !== 'group') return
    expect(mirrored.children[0]).toMatchObject({ kind: 'annotation', id: 'a-m', annotation: { text: 'A' } })
  })
  it('кромка, рез тесіктері және 90° топтың әлемдегі X орнын шағылыстырады', () => {
    const group: GroupNode = { kind: 'group', id: 'g', name: 'Топ',
      transform: { pos: { x: 200, y: 0, z: 0 }, rot: { x: 0, y: 90, z: 0 } }, children: [board()] }
    const mirrored = mirrorFreeNodeX(group, SEED_CATALOG, 500, '-mirror')
    expect(mirrored.kind).toBe('group')
    if (mirrored.kind !== 'group') return
    expect(mirrored.transform).toEqual({ pos: { x: 800, y: 0, z: 0 }, rot: { x: 0, y: -90, z: 0 } })
    const reflected = mirrored.children[0]
    expect(reflected?.kind).toBe('board')
    if (reflected?.kind !== 'board') return
    expect(reflected.id).toBe('b-mirror')
    expect(reflected.transform.pos).toEqual({ x: -210, y: 0, z: 0 })
    expect(reflected.board.edges).toEqual({ L1: null, L2: { bandId: band.id }, W1: null, W2: null })
    expect(reflected.board.drilling).toMatchObject([
      { face: 'inner', x: 128, y: 134 },
      { face: 'edgeW1', x: 148, y: 8 },
      { face: 'edgeL2', x: 128, y: 8 },
    ])
    const root: GroupNode = { kind: 'group', id: 'root', name: 'root', transform: structuredClone(IDENTITY_TRANSFORM), children: [group, mirrored] }
    const positions = new Map<string, number>()
    walkTree(root, (node, pose) => positions.set(node.id, pose.position.x))
    expect(positions.get('g')).toBe(200)
    expect(positions.get('g-mirror')).toBe(800)
  })
  it('X ұзындық болса W1/W2 мен рездегі X-ті, X қалыңдық болса кең беттерді ауыстырады', () => {
    const lengthBoard = board()
    lengthBoard.board.orientation = { length: 'x', width: 'y', thickness: 'z' }
    lengthBoard.board.edges = { L1: null, L2: null, W1: { bandId: band.id }, W2: null }
    const mirroredLength = mirrorFreeNodeX(lengthBoard, SEED_CATALOG, 400, '-m')
    expect(mirroredLength.kind).toBe('board')
    if (mirroredLength.kind !== 'board') return
    expect(mirroredLength.board.edges.W1).toBeNull()
    expect(mirroredLength.board.edges.W2).toEqual({ bandId: band.id })
    expect(mirroredLength.board.drilling).toMatchObject([
      { face: 'inner', x: 470, y: 64 },
      { face: 'edgeW2', x: 50, y: 8 },
      { face: 'edgeL1', x: 470, y: 8 },
    ])
    expect(mirroredLength.transform.pos.x).toBe(190)

    const thicknessBoard = board()
    thicknessBoard.board.orientation = { length: 'y', width: 'z', thickness: 'x' }
    const mirroredThickness = mirrorFreeNodeX(thicknessBoard, SEED_CATALOG, 400, '-m')
    expect(mirroredThickness.kind).toBe('board')
    if (mirroredThickness.kind !== 'board') return
    expect(mirroredThickness.board.drilling).toMatchObject([
      { face: 'outer', x: 128, y: 64 },
      { face: 'edgeW1', x: 50, y: 8 },
      { face: 'edgeL1', x: 128, y: 8 },
    ])
    expect(mirroredThickness.transform.pos.x).toBe(774)
  })
  it('айнасы есептелмеген өндірістік операцияны үнсіз көшірмейді', () => {
    const withCutout = board()
    withCutout.board.cutouts = [{ id: 'cut', shape: 'rect', corner: 'bottomLeft', x: 10, y: 10, width: 20, height: 20 }]
    expect(() => mirrorFreeNodeX(withCutout, SEED_CATALOG, 400, '-m')).toThrow(/контур|ойма/)
  })
})
