import { describe, expect, it } from 'vitest'
import {
  IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, ORIENT_SIDE, ORIGIN_POSE, SEED_CATALOG,
  SEED_TEMPLATES, autoJoint, flattenTree, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { BoardNode, FlatScene, GroupNode } from '../src/core/index'

const materialId = SEED_CATALOG.materials.find((m) => m.thickness === 16)!.id
const noEdges = { L1: null, L2: null, W1: null, W2: null }
const board = (id: string, pos: { x: number; y: number; z: number }, orientation: BoardNode['board']['orientation'], length: number, width: number): BoardNode => ({
  id, name: id, kind: 'board', transform: { pos, rot: { x: 0, y: 0, z: 0 } },
  board: { materialId, length, width, orientation, edges: noEdges, grainAlongLength: true, role: 'custom' },
})
const joined = (): GroupNode => ({ id: 'root', name: 'root', kind: 'group', transform: IDENTITY_TRANSFORM, children: [
  board('base', { x: 0, y: 0, z: 0 }, ORIENT_HORIZONTAL, 500, 300),
  board('upright', { x: 0, y: 16, z: 0 }, ORIENT_SIDE, 500, 300),
] })

describe('autoJoint: еркін тақта буыны', () => {
  it('бекіткіш түрі нақты таңдалғанда ғана жанасқан тақталарға конфирмат тесігін ұсынады', () => {
    const result = autoJoint(flattenTree(joined(), SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG)
    expect(result).toHaveLength(2)
    expect(result.find((item) => item.boardId === 'base')?.drilling).toEqual(expect.arrayContaining([
      expect.objectContaining({ purpose: 'confirmat', face: 'outer', diameter: 8 }),
    ]))
    expect(result.find((item) => item.boardId === 'upright')?.drilling).toEqual(expect.arrayContaining([
      expect.objectContaining({ purpose: 'confirmat', face: 'edgeW1', diameter: 5 }),
    ]))
  })

  it('ажыраған тақталарға тесік шығармайды', () => {
    const root = joined()
    const upright = root.children[1] as BoardNode
    upright.transform.pos.y += 5
    expect(() => autoJoint(flattenTree(root, SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG)).toThrow(/жанас/)
    expect(autoJoint(flattenTree(root, SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG, undefined, 5)
      .flatMap((item) => item.drilling)).toHaveLength(4)
    expect(() => autoJoint(flattenTree(root, SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG, undefined, 0.5)).toThrow(/бүтін мм/)
  })

  it('минификс бөлек тесіктер береді, артикулы белгісіз шканттан бас тартады', () => {
    const scene = flattenTree(joined(), SEED_CATALOG)
    const result = autoJoint(scene, ['base', 'upright'], 'minifix', SEED_CATALOG)
    expect(result.flatMap((item) => item.drilling)).not.toHaveLength(0)
    expect(result.flatMap((item) => item.drilling).every((hole) => hole.purpose === 'minifix')).toBe(true)
    expect(() => autoJoint(scene, ['base', 'upright'], 'dowel', SEED_CATALOG)).toThrow(/артикул/)
  })

  it('генератор корпусының крышка–сол боковина конфирматымен бірдей координата береді', () => {
    const template = SEED_TEMPLATES.find((item) => item.id === 'wardrobe-penal-600')!
    const panels = generateCabinet(templateToCabinet(template, SEED_CATALOG), SEED_CATALOG)
    const top = panels.find((panel) => panel.id === 'top')!
    const side = panels.find((panel) => panel.id === 'side-left')!
    const scene: FlatScene = { solids: [], nodes: [
      { nodeId: 'top', name: 'Крышка', panels: [top], hardware: [], pose: ORIGIN_POSE },
      { nodeId: 'side', name: 'Боковина', panels: [side], hardware: [], pose: ORIGIN_POSE },
    ] }
    const result = autoJoint(scene, ['top', 'side'], 'confirmat', SEED_CATALOG)
    expect(result.find((item) => item.boardId === 'top')?.drilling).toEqual(
      top.drilling.filter((hole) => hole.purpose === 'confirmat' && hole.face === 'edgeW1'))
    expect(result.find((item) => item.boardId === 'side')?.drilling).toEqual(
      side.drilling.filter((hole) => hole.purpose === 'confirmat' && hole.x > 1000))
  })

  it('генератор цоколь қорабының алдыңғы–сол бүйір минификсімен бірдей координата береді', () => {
    const template = SEED_TEMPLATES.find((item) => item.id === 'kitchen-base-600')!
    const config = templateToCabinet(template, SEED_CATALOG)
    config.base = { kind: 'plinth', height: 100, plinthShape: 'box', plinthJoint: 'minifix' }
    const panels = generateCabinet(config, SEED_CATALOG)
    const front = panels.find((panel) => panel.id === 'plinth')!
    const left = panels.find((panel) => panel.id === 'plinth-left')!
    const scene: FlatScene = { solids: [], nodes: [
      { nodeId: 'front', name: 'Алды', panels: [front], hardware: [], pose: ORIGIN_POSE },
      { nodeId: 'left', name: 'Бүйір', panels: [left], hardware: [], pose: ORIGIN_POSE },
    ] }
    const result = autoJoint(scene, ['front', 'left'], 'minifix', SEED_CATALOG)
    expect(result.find((item) => item.boardId === 'front')?.drilling).toEqual(
      front.drilling.filter((hole) => hole.purpose === 'minifix' && hole.x < 100))
    expect(result.find((item) => item.boardId === 'left')?.drilling).toEqual(
      left.drilling.filter((hole) => hole.purpose === 'minifix' && (hole.face === 'edgeL1' || hole.y === 32)))
  })

  it('қатар жатқан беттерді және тесігі сыймайтын қысқа минификсті қабылдамайды', () => {
    const parallel = joined()
    const second = parallel.children[1] as BoardNode
    second.board.orientation = ORIENT_HORIZONTAL
    expect(() => autoJoint(flattenTree(parallel, SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG)).toThrow(/жанас/)

    const short = joined()
    for (const node of short.children) if (node.kind === 'board') node.board.width = 30
    expect(() => autoJoint(flattenTree(short, SEED_CATALOG), ['base', 'upright'], 'minifix', SEED_CATALOG)).toThrow(/сыймады/)

    const tooNarrow = joined()
    for (const node of tooNarrow.children) if (node.kind === 'board') node.board.width = 6
    expect(() => autoJoint(flattenTree(tooNarrow, SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG)).toThrow(/сыймады/)
  })
})
