/**
 * v3 ЖОБА → АҒАШ.
 *
 * Бұл — 2-фазадағы schemaVersion 4 миграциясының негізі. Талап біреу:
 * ағашқа айналдырғаннан кейін шкаф дәл сол жерде тұруы керек, әйтпесе
 * сақталған жобаның бөлмесі бұзылады.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, findTemplate, placementPose, templateToCabinet, treeFromProject,
} from '../src/core/index'
import type { CabinetConfig, ProjectFile } from '../src/core/index'

const cab = (id: string): CabinetConfig =>
  ({ ...templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG), id })

const project = (cabinets: CabinetConfig[], placements: ProjectFile['placements']): ProjectFile => ({
  schemaVersion: 3,
  name: 'Тест',
  materials: SEED_CATALOG.materials,
  edgeBands: SEED_CATALOG.edgeBands,
  cabinets,
  room: { width: 4000, depth: 3000, height: 2700 },
  placements,
})

describe('treeFromProject', () => {
  it('әр шкаф — түбірдің бір баласы', () => {
    const root = treeFromProject(project(
      [cab('c1'), cab('c2')],
      [{ cabinetId: 'c1', wall: 'south', offset: 0 }, { cabinetId: 'c2', wall: 'south', offset: 600 }],
    ))
    expect(root.kind).toBe('group')
    expect(root.children.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(root.children.every((c) => c.kind === 'cabinet')).toBe(true)
  })

  it('трансформа placementPose-пен ДӘЛ бірдей орын береді', () => {
    const p = project([cab('c1')], [{ cabinetId: 'c1', wall: 'east', offset: 500, elevation: 700, rotate: 15 }])
    const pose = placementPose(p.room, p.cabinets[0]!, p.placements[0]!)
    const node = treeFromProject(p).children[0]!
    expect(node.transform.pos).toEqual(pose.position)
    expect(node.transform.rot.y).toBe(pose.rotationY)
    expect(node.transform.rot.x).toBe(0)
    expect(node.transform.rot.z).toBe(0)
  })

  it('орны жоқ шкаф ағашқа кірмейді (useSceneItems-тегі сол ереже)', () => {
    const root = treeFromProject(project([cab('c1'), cab('c2')], [{ cabinetId: 'c1', wall: 'south', offset: 0 }]))
    expect(root.children.map((c) => c.id)).toEqual(['c1'])
  })

  it('түбірдің трансформасы бірлік', () => {
    const root = treeFromProject(project([], []))
    expect(root.transform).toEqual({ pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } })
  })

  it('түйіннің аты — шкафтың аты', () => {
    const root = treeFromProject(project([cab('c1')], [{ cabinetId: 'c1', wall: 'south', offset: 0 }]))
    expect(root.children[0]!.name).toBe(cab('c1').name)
  })
})
