import { afterEach, describe, expect, it } from 'vitest'
import {
  IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, ORIENT_SIDE, SEED_CATALOG,
  autoJoint, findNode, flattenTree, parseProjectV4,
} from '../src/core/index'
import type { BoardNode, GroupNode, ProjectFileV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()
const state = () => useConfigurator.getState()
afterEach(() => useConfigurator.setState(initial, true))

const material16 = SEED_CATALOG.materials.find((item) => item.thickness === 16)!
const material18 = SEED_CATALOG.materials.find((item) => item.thickness === 18)!
const band2 = SEED_CATALOG.edgeBands.find((item) => item.thickness === 2)!
const manual = { face: 'inner' as const, x: 80, y: 80, diameter: 5, depth: 8, purpose: 'shelfPin' as const }

function board(id: string, y: number, orientation: BoardNode['board']['orientation']): BoardNode {
  return { kind: 'board', id, name: id,
    transform: { pos: { x: 0, y, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    board: { materialId: material16.id, length: 500, width: 300, orientation,
      edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: true,
      role: 'custom', ...(id === 'base' ? { drilling: [manual] } : {}) } }
}

function file(): ProjectFileV4 {
  const root: GroupNode = { kind: 'group', id: 'root', name: 'root', transform: IDENTITY_TRANSFORM,
    children: [board('base', 0, ORIENT_HORIZONTAL), board('upright', 16, ORIENT_SIDE)] }
  return { schemaVersion: 4, name: 'Буын', root, lights: [],
    materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
    room: { width: 4000, depth: 3000, height: 2700 } }
}

function generated() {
  const s = state()
  return flattenTree(s.root, s.catalog, s.projectSettings ?? s.shop.settings, s.layers, s.autoJoints)
    .nodes.flatMap((node) => node.panels.flatMap((panel) => panel.drilling))
}

function expected() {
  const s = state()
  return autoJoint(flattenTree(s.root, s.catalog, s.projectSettings ?? s.shop.settings, s.layers),
    ['base', 'upright'], s.autoJoints[0]!.kind, s.catalog, s.projectSettings ?? s.shop.settings)
    .flatMap((result) => result.drilling)
}

describe('store автоматты буынның provenance дерегі', () => {
  it('буынды v4-ке бөлек сақтайды; бір undo/redo қадамы қол тесігіне тимейді', () => {
    state().loadProject(file())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    expect(state().autoJoints).toHaveLength(1)
    expect(state().autoJoints[0]).toMatchObject({ boardIds: ['base', 'upright'], kind: 'confirmat', status: 'valid' })
    expect((findNode(state().root, 'base') as BoardNode).board.drilling).toEqual([manual])
    expect((findNode(state().root, 'upright') as BoardNode).board.drilling).toBeUndefined()
    expect(generated()).toEqual([manual, ...expected()])
    const saved = parseProjectV4(JSON.parse(JSON.stringify(state().exportProject())))
    expect(saved.autoJoints).toEqual(state().autoJoints)
    state().undo()
    expect(state().autoJoints).toEqual([])
    expect(generated()).toEqual([manual])
    state().redo()
    expect(state().autoJoints).toEqual(saved.autoJoints)
    expect(generated()).toEqual([manual, ...expected()])
  })

  it('кромка мен өлшем өзгерсе тек жаңа координатаны береді және қайтарғанда бастапқысы келеді', () => {
    state().loadProject(file())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    const before = generated()
    state().editBoard('upright', { width: 280,
      edges: { L1: null, L2: null, W1: { bandId: band2.id }, W2: null } })
    expect(state().autoJoints[0]?.status).toBe('valid')
    expect(generated()).toEqual([manual, ...expected()])
    expect(generated()).not.toEqual(before)
    state().undo()
    expect(generated()).toEqual(before)
    state().redo()
    expect(generated()).toEqual([manual, ...expected()])
  })

  it('16→18 мм және орын ауысқанда жаңа тереңдік/торц ортасын береді; ажырасса ескертеді', () => {
    state().loadProject(file())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    state().editBoard('base', { materialId: material18.id })
    state().editBoard('upright', { materialId: material18.id })
    expect(state().autoJoints[0]).toMatchObject({ status: 'broken', error: { field: 'joint.boardIds' } })
    expect(generated()).toEqual([manual])
    state().setBoardPosition('upright', { x: 0, y: 18, z: 0 })
    expect(state().autoJoints[0]?.status).toBe('valid')
    expect(generated()).toEqual([manual, ...expected()])
    expect(generated().some((hole) => hole.face === 'outer' && hole.depth === 18)).toBe(true)
    expect(generated().some((hole) => hole.face === 'edgeW1' && hole.y === 9)).toBe(true)
    state().setBoardPosition('upright', { x: 0, y: 40, z: 0 })
    expect(state().autoJoints[0]?.status).toBe('broken')
    expect(state().autoJoints[0]?.error?.field).toBe('joint.boardIds')
    expect(generated()).toEqual([manual])
    state().undo()
    expect(state().autoJoints[0]?.status).toBe('valid')
    expect(generated()).toEqual([manual, ...expected()])
  })

  it('цехтағы материал қалыңдығы өзгерсе сақталған буынды дереу қайта тексереді', () => {
    state().loadProject(file())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    const updatedMaterials = state().shop.materials.map((material) =>
      material.id === material16.id ? { ...material, thickness: 18 } : material)
    state().editShop({ materials: updatedMaterials })
    expect(state().catalog.materials.find((material) => material.id === material16.id)?.thickness).toBe(18)
    expect(state().autoJoints[0]).toMatchObject({ status: 'broken', error: { field: 'joint.boardIds' } })
    expect(generated()).toEqual([manual])
    state().undo()
    expect(state().catalog.materials.find((material) => material.id === material16.id)?.thickness).toBe(16)
    expect(state().autoJoints[0]?.status).toBe('valid')
    state().redo()
    expect(state().catalog.materials.find((material) => material.id === material16.id)?.thickness).toBe(18)
    expect(state().autoJoints[0]?.status).toBe('broken')
  })

  it('v4 жоба қайта ашылғанда қол тесігі мен буын дәл сақталады', () => {
    state().loadProject(file())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    const before = generated()
    const saved = JSON.parse(JSON.stringify(state().exportProject()))
    state().loadProject(file())
    expect(state().autoJoints).toEqual([])
    state().loadProject(saved)
    expect(generated()).toEqual(before)
    expect((findNode(state().root, 'base') as BoardNode).board.drilling).toEqual([manual])
  })

  it('бекіткіш түрі ауысса minifix тесіктерін бір қадамда қайта құрады', () => {
    state().loadProject(file())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    state().setAutoJointKind(state().autoJoints[0]!.id, 'minifix')
    expect(generated()).toEqual([manual, ...expected()])
    expect(generated().filter((hole) => hole.purpose !== 'shelfPin').every((hole) => hole.purpose === 'minifix')).toBe(true)
    state().undo()
    expect(state().autoJoints[0]?.kind).toBe('confirmat')
    expect(generated()).toEqual([manual, ...expected()])
  })

  it('қол тесігінің шегінен асқан өзгеріс өріс атымен қабылданбайды', () => {
    state().loadProject(file())
    expect(() => state().editBoard('base', { drilling: [{ ...manual, depth: 17 }] }))
      .toThrow(/board\[base\]\.drilling\.0\.depth/)
    expect((findNode(state().root, 'base') as BoardNode).board.drilling).toEqual([manual])
  })
})
