import { describe, expect, it } from 'vitest'
import {
  IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, ORIENT_SIDE, SEED_CATALOG,
  applyAutoJointChange, autoJoint, createAutoJoint, flattenTree, parseProjectV4,
  rebuildAutoJoints, validateJointDrill,
} from '../src/core/index'
import type { BoardNode, GroupNode, ProjectFileV4 } from '../src/core/index'

const material16 = SEED_CATALOG.materials.find((m) => m.thickness === 16)!
const band2 = SEED_CATALOG.edgeBands.find((b) => b.thickness === 2)!
const edges = { L1: null, L2: null, W1: null, W2: null }
function board(id: string, y: number, orientation: BoardNode['board']['orientation']): BoardNode {
  return { kind: 'board', id, name: id, transform: { pos: { x: 0, y, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    board: { materialId: material16.id, length: 500, width: 300, orientation, edges,
      grainAlongLength: true, role: 'custom' } }
}
function root(): GroupNode {
  return { kind: 'group', id: 'root', name: 'root', transform: IDENTITY_TRANSFORM,
    children: [board('base', 0, ORIENT_HORIZONTAL), board('upright', 16, ORIENT_SIDE)] }
}
function file(): ProjectFileV4 {
  const r = root()
  return { schemaVersion: 4, name: 'Буын', materials: SEED_CATALOG.materials,
    edgeBands: SEED_CATALOG.edgeBands, room: { width: 4000, depth: 3000, height: 2700 },
    lights: [], root: r }
}
const drill = (f: ProjectFileV4) => flattenTree(f.root,
  { materials: f.materials, edgeBands: f.edgeBands }, f.settings, f.layers, f.autoJoints)
  .nodes.flatMap((n) => n.panels.flatMap((p) => p.drilling))

describe('сақталған автоматты буын', () => {
  it('еркін тақтаның қол Ø35 тесігі шеттен асып кетсе, flattenTree экспортқа панель бермейді', () => {
    const scene = root()
    ;(scene.children[0] as BoardNode).board.drilling = [{ face: 'inner', x: 0, y: 160,
      diameter: 35, depth: 12.5, purpose: 'hinge' }]
    expect(() => flattenTree(scene, SEED_CATALOG)).toThrow(/board\[base\].*position/)
  })
  it('қалыңдық 16→18 мм ауысқанда өтпелі тереңдік пен торц осі қайта есептеледі; кері қайтса тең', () => {
    const initial = applyAutoJointChange(file(), { create: { id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat' } })
    const old = drill(initial)
    expect(old.some((d) => d.face === 'outer' && d.depth === 16)).toBe(true)
    const incompatible = applyAutoJointChange(initial, { materials: initial.materials.map((m) =>
      m.id === material16.id ? { ...m, thickness: 18 } : m) })
    expect(incompatible.autoJoints?.[0]).toMatchObject({ status: 'broken', error: { field: 'joint.boardIds' } })
    const moved = structuredClone(initial.root)
    ;(moved.children[1] as BoardNode).transform.pos.y = 18
    const changed = applyAutoJointChange(initial, { root: moved, materials: initial.materials.map((m) =>
      m.id === material16.id ? { ...m, thickness: 18 } : m) })
    expect(drill(changed).some((d) => d.face === 'outer' && d.depth === 18)).toBe(true)
    expect(drill(changed).some((d) => d.face === 'edgeW1' && d.y === 9)).toBe(true)
    expect(drill(changed)).toEqual(autoJoint(flattenTree(changed.root,
      { materials: changed.materials, edgeBands: changed.edgeBands }), ['base', 'upright'],
    'confirmat', { materials: changed.materials, edgeBands: changed.edgeBands }).flatMap((item) => item.drilling))
    expect(drill(applyAutoJointChange(changed, { root: initial.root, materials: initial.materials }))).toEqual(old)
  })

  it('кромка, өлшем және бекіткіш өзгерсе, тек жаңа есептің тесіктері қалады', () => {
    const initial = applyAutoJointChange(file(), { create: { id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat' } })
    const nextRoot = structuredClone(initial.root)
    const upright = nextRoot.children[1] as BoardNode
    upright.board.width = 280
    upright.board.edges = { ...upright.board.edges, W1: { bandId: band2.id } }
    const changed = applyAutoJointChange(initial, { root: nextRoot })
    expect(changed.autoJoints?.[0]?.status).toBe('valid')
    expect(drill(changed)).toEqual(changed.autoJoints![0]!.drilling.flatMap((item) => item.drilling))
    expect(drill(changed)).not.toEqual(drill(initial))
    expect(drill(changed)).toEqual(autoJoint(flattenTree(changed.root,
      { materials: changed.materials, edgeBands: changed.edgeBands }), ['base', 'upright'],
    'confirmat', { materials: changed.materials, edgeBands: changed.edgeBands }).flatMap((item) => item.drilling))
    const switched = applyAutoJointChange(changed, { joint: { id: 'j1', kind: 'minifix' } })
    expect(drill(switched).length).toBeGreaterThan(0)
    expect(drill(switched).every((d) => d.purpose === 'minifix')).toBe(true)
    expect(drill(applyAutoJointChange(switched, { joint: { id: 'j1', kind: 'confirmat' }, root: initial.root }))).toEqual(drill(initial))
  })

  it('ажыратылған буын бұзылды күйін және өріс қатесін сақтайды; қол тесігін қозғамайды', () => {
    const start = file()
    ;(start.root.children[0] as BoardNode).board.drilling = [
      { face: 'inner', x: 80, y: 80, diameter: 5, depth: 8, purpose: 'shelfPin' },
    ]
    const initial = applyAutoJointChange(start, { create: { id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat' } })
    const moved = structuredClone(initial.root)
    ;(moved.children[1] as BoardNode).transform.pos.y += 5
    const broken = applyAutoJointChange(initial, { root: moved })
    expect(broken.autoJoints?.[0]).toMatchObject({ status: 'broken', error: { field: 'joint.boardIds' }, drilling: [] })
    expect(drill(broken)).toEqual((start.root.children[0] as BoardNode).board.drilling)
    expect(drill(applyAutoJointChange(broken, { root: initial.root }))).toEqual(drill(initial))
  })

  it('v4 round-trip, бұрынғы файл миграциясы және буынның қол түзету белгісі', () => {
    const initial = applyAutoJointChange(file(), { create: { id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat', edited: true } })
    expect(parseProjectV4(JSON.parse(JSON.stringify(initial))).autoJoints).toEqual(initial.autoJoints)
    const stale = structuredClone(initial)
    stale.autoJoints![0]!.drilling[0]!.drilling[0]!.depth = 1
    expect(parseProjectV4(stale).autoJoints).toEqual(initial.autoJoints)
    expect(parseProjectV4(file()).autoJoints).toEqual([])
    expect(() => parseProjectV4({ ...initial, autoJoints: [{ ...initial.autoJoints![0], boardIds: ['missing', 'upright'] }] }))
      .toThrow(/boardIds/)
  })

  it('қайта есеп таза және бастапқы бұрғыны мутацияламайды', () => {
    const initial = applyAutoJointChange(file(), { create: { id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat' } })
    const before = structuredClone(initial)
    expect(rebuildAutoJoints(initial.root, initial.autoJoints!,
      { materials: initial.materials, edgeBands: initial.edgeBands })).toEqual(initial.autoJoints)
    expect(initial).toEqual(before)
    expect(createAutoJoint(initial.root, ['base', 'upright'], 'confirmat',
      { materials: initial.materials, edgeBands: initial.edgeBands }, undefined, 0, 'j2').id).toBe('j2')
  })

  it('тесік орны, тереңдігі және торц ортасы өріс атымен тексеріледі', () => {
    const r = root()
    const panel = flattenTree(r, SEED_CATALOG).nodes[0]!.panels[0]!
    const face = { face: 'outer' as const, x: 50, y: 50, diameter: 8, depth: 16, purpose: 'confirmat' as const }
    expect(() => validateJointDrill(panel, { ...face, depth: 17 }, 16, 'board[base].drilling.0'))
      .toThrow(/board\[base\]\.drilling\.0\.depth/)
    expect(() => validateJointDrill(panel, { ...face, x: -1 }, 16, 'board[base].drilling.0'))
      .toThrow(/board\[base\]\.drilling\.0\.position/)
    expect(() => validateJointDrill(panel, { ...face, face: 'edgeW1', y: 7, depth: 35 }, 16, 'board[base].drilling.0'))
      .toThrow(/ортасында емес/)
    ;(r.children[0] as BoardNode).board.drilling = [{ ...face, depth: 17 }]
    expect(() => parseProjectV4({ ...file(), root: r })).toThrow(/board\[base\]\.drilling\.0\.depth/)
  })

  it('жасырын тақтаның қол тесігін тексереді, басқа ақаулы тақтаға тәуелді емес', () => {
    const r = root()
    const base = r.children[0] as BoardNode
    const upright = r.children[1] as BoardNode
    base.hidden = true
    base.board.drilling = [{ face: 'inner', x: 50, y: 50, diameter: 8, depth: 17, purpose: 'confirmat' }]
    expect(() => parseProjectV4({ ...file(), root: r })).toThrow(/board\[base\]\.drilling\.0\.depth/)
    base.hidden = false
    base.board.drilling[0]!.depth = 8
    upright.board.materialId = 'unavailable-material'
    expect(() => parseProjectV4({ ...file(), root: r })).not.toThrow()
  })

  it('қол тесігімен бір координатаға авто тесік қоспайды және қол тесігін сақтайды', () => {
    const start = file()
    const proposed = autoJoint(flattenTree(start.root, SEED_CATALOG), ['base', 'upright'], 'confirmat', SEED_CATALOG)
    const first = proposed.find((item) => item.boardId === 'base')!.drilling[0]!
    const base = start.root.children[0] as BoardNode
    base.board.drilling = [first]
    expect(() => applyAutoJointChange(start, { create: {
      id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat' } })).toThrow(/board\[base\]\.drilling/)
    base.board.drilling = []
    const joined = applyAutoJointChange(start, { create: {
      id: 'j1', boardIds: ['base', 'upright'], kind: 'confirmat' } })
    const changed = structuredClone(joined.root)
    ;(changed.children[0] as BoardNode).board.drilling = [first]
    const broken = applyAutoJointChange(joined, { root: changed })
    expect(broken.autoJoints?.[0]).toMatchObject({ status: 'broken', error: { field: 'board[base].drilling' } })
    expect(drill(broken)).toEqual([first])
  })
})
