/**
 * АҒАШТЫҢ ЖАЙЫЛУЫ.
 *
 * Басты талап: `cabinet` түйіні `generateCabinet`-тің нәтижесін СОЛ КҮЙІНДЕ
 * береді. Панельдер түйіннің ЛОКАЛ кеңістігінде қалады, ал әлемдегі орны
 * бөлек `pose` болып шығады — өндірістік тізбек орынды қарамайды, 3D қарайды.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, findTemplate, flattenTree, generateCabinet, scenePanels, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, GroupNode, SceneNode, Transform } from '../src/core/index'

const tr = (x = 0, y = 0, z = 0, rotY = 0): Transform =>
  ({ pos: { x, y, z }, rot: { x: 0, y: rotY, z: 0 } })

const cab = (): CabinetConfig => {
  const config = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
  // Фурнитура болатындай база қосамын
  return {
    ...config,
    base: { kind: 'legs', legType: 'cylinder', legPlate: 'round', legStep: 80, height: 100 },
  }
}

const cabinetNode = (id: string, config: CabinetConfig, transform: Transform): SceneNode =>
  ({ kind: 'cabinet', id, name: config.name, transform, config })

const root = (children: SceneNode[], transform = tr()): GroupNode =>
  ({ kind: 'group', id: 'root', name: 'Жоба', transform, children })

describe('flattenTree — корпус түйіні', () => {
  it('generateCabinet-тің панельдерін сол күйінде береді', () => {
    const config = cab()
    const scene = flattenTree(root([cabinetNode('c1', config, tr())]), SEED_CATALOG)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0]!.panels).toEqual(generateCabinet(config, SEED_CATALOG))
  })

  it('фурнитураны да береді', () => {
    const scene = flattenTree(root([cabinetNode('c1', cab(), tr())]), SEED_CATALOG)
    expect(scene.nodes[0]!.hardware.length).toBeGreaterThan(0)
  })

  it('панельдің орны ЛОКАЛ қалады — поза бөлек', () => {
    const config = cab()
    const scene = flattenTree(root([cabinetNode('c1', config, tr(2000, 0, 500))]), SEED_CATALOG)
    const local = generateCabinet(config, SEED_CATALOG)
    expect(scene.nodes[0]!.panels[0]!.position).toEqual(local[0]!.position)
    expect(scene.nodes[0]!.pose.position).toEqual({ x: 2000, y: 0, z: 500 })
  })

  it('топтың трансформасы балаға қосылады', () => {
    const inner: GroupNode = {
      kind: 'group', id: 'g1', name: 'Қатар', transform: tr(1000, 0, 0),
      children: [cabinetNode('c1', cab(), tr(600, 0, 0))],
    }
    const scene = flattenTree(root([inner]), SEED_CATALOG)
    const node = scene.nodes.find((n) => n.nodeId === 'c1')!
    expect(node.pose.position.x).toBe(1600)
  })

  it('топтың өзі FlatNode бермейді — ол тек контейнер', () => {
    const scene = flattenTree(root([cabinetNode('c1', cab(), tr())]), SEED_CATALOG)
    expect(scene.nodes.map((n) => n.nodeId)).toEqual(['c1'])
  })
})

describe('scenePanels', () => {
  it('барлық түйіннің панелін бір тізімге жинайды', () => {
    const config = cab()
    const scene = flattenTree(root([
      cabinetNode('c1', config, tr()),
      cabinetNode('c2', config, tr(600, 0, 0)),
    ]), SEED_CATALOG)
    expect(scenePanels(scene)).toHaveLength(generateCabinet(config, SEED_CATALOG).length * 2)
  })
})
