/**
 * Бөлме өлшемі өзгергенде тек қабырғаға тіреліп тұрған өңделетін шкаф
 * қабырғамен бірге жылжиды; құлыпталған/еркін түйін бұғаттамайды да, секірмейді.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, SEED_SETS, parseProjectV4, setToProject, walkTree,
} from '../src/core/index'
import type { CabinetConfig, Placement, Pose, Room } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => {
  useConfigurator.setState({
    root: baseline.root, layers: baseline.layers, room: baseline.room,
    projectSettings: baseline.projectSettings, projectMaterials: baseline.projectMaterials,
    projectEdgeBands: baseline.projectEdgeBands, catalog: baseline.catalog,
    cabinets: baseline.cabinets, placements: baseline.placements,
    activeId: baseline.activeId, past: [], future: [], projectLoadError: null,
  })
})

const s = () => useConfigurator.getState()
const room: Room = { width: 4000, depth: 3000, height: 2700 }
const seed = setToProject(SEED_SETS[0]!, SEED_CATALOG).cabinets[0]!
const cab = (id: string): CabinetConfig => ({ ...seed, id, name: `Модуль ${id}` })
const v3 = (cabinets: CabinetConfig[], placements: Placement[], extra: object = {}) => ({
  schemaVersion: 3, name: 'Жоба', materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
  room, cabinets, placements, ...extra,
})

function worldPoses(): Map<string, Pose> {
  const out = new Map<string, Pose>()
  walkTree(s().root, (node, pose) => { out.set(node.id, pose) })
  return out
}

describe('бөлмені өзгерту (editRoom)', () => {
  it('құлыпталған шкаф бөлме өзгерісін бұғаттамайды және орнында қалады', () => {
    s().loadProject(v3([cab('a'), cab('b')], [
      { cabinetId: 'a', wall: 'north', offset: 0 }, { cabinetId: 'b', wall: 'north', offset: 1000 },
    ]))
    s().setNodeLocked('a', true)
    const before = worldPoses()
    expect(() => s().editRoom({ width: 5000 })).not.toThrow()
    expect(s().room.width).toBe(5000)
    expect(worldPoses().get('a')).toEqual(before.get('a'))
    // Құлыпсыз көршісі солтүстік қабырғамен бірге жылжиды (v3 мінезі).
    expect(worldPoses().get('b')!.position.x).toBe(before.get('b')!.position.x + 1000)
  })

  it('қабырғаға тимейтін еркін шкаф биіктік өзгергенде қабырғаға секірмейді', () => {
    const file = parseProjectV4(v3([cab('a')], [{ cabinetId: 'a', wall: 'south', offset: 0 }]))
    file.root.children[0]!.transform = { pos: { x: 1500, y: 0, z: 1200 }, rot: { x: 0, y: 0, z: 0 } }
    s().loadProject(file)
    const before = worldPoses().get('a')
    s().editRoom({ height: 2800 })
    expect(worldPoses().get('a')).toEqual(before)
  })

  it('30°-қа бұрылған топтағы шкаф бөлме өзгерісін құлатпайды', () => {
    const file = parseProjectV4(v3([cab('a'), cab('b')], [
      { cabinetId: 'a', wall: 'south', offset: 0 }, { cabinetId: 'b', wall: 'south', offset: 1000 },
    ]))
    const [a, b] = file.root.children
    file.root.children = [{ kind: 'group', id: 'g', name: 'Топ',
      transform: { pos: { x: 500, y: 0, z: 500 }, rot: { x: 0, y: 30, z: 0 } },
      children: [{ ...a!, transform: { pos: { x: 100, y: 0, z: 100 }, rot: { x: 0, y: 0, z: 0 } } }] }, b!]
    s().loadProject(file)
    const before = worldPoses().get('a')
    expect(() => s().editRoom({ height: 2800 })).not.toThrow()
    expect(worldPoses().get('a')).toEqual(before)
  })

  it('бұрылған топтағы, бірақ қабырғаға дәл тиген шкаф да бөлме тереңдігін өзгертуді құлатпайды', () => {
    const file = parseProjectV4(v3([cab('a')], [{ cabinetId: 'a', wall: 'south', offset: 0 }]))
    const a = file.root.children[0]!
    // Топ 30°-қа бұрылған, шкаф оны −30°-пен қайтарады: әлемде ол оңтүстік қабырғада.
    file.root.children = [{ kind: 'group', id: 'g', name: 'Топ',
      transform: { pos: a.transform.pos, rot: { x: 0, y: 30, z: 0 } },
      children: [{ ...a, transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: -30, z: 0 } } }] }]
    s().loadProject(file)
    const before = worldPoses().get('a')
    expect(() => s().editRoom({ depth: 3500 })).not.toThrow()
    expect(worldPoses().get('a')).toEqual(before)
  })

  it('жасырын қабаттағы шкаф та қабырғамен бірге жылжиды', () => {
    const file = parseProjectV4(v3([cab('a'), cab('b')], [
      { cabinetId: 'a', wall: 'north', offset: 0 }, { cabinetId: 'b', wall: 'north', offset: 1000 },
    ], { layers: [
      { id: 'main', name: 'Негізгі', visible: true, locked: false, color: '#ffffff' },
      { id: 'off', name: 'Жасырын', visible: false, locked: false, color: '#000000' },
    ] }))
    file.root.children[1]!.layerId = 'off'
    s().loadProject(file)
    const before = worldPoses()
    s().editRoom({ width: 5000 })
    expect(worldPoses().get('b')!.position.x).toBe(before.get('b')!.position.x + 1000)
  })
})
