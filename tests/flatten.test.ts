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
  ConfigValidationError, ORIENT_HORIZONTAL,
} from '../src/core/index'
import type { CabinetConfig, GroupNode, SceneNode, Transform, BoardSpec } from '../src/core/index'

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

const BAND_2MM = SEED_CATALOG.edgeBands.find((b) => b.thickness === 2)!
const LDSP_16 = SEED_CATALOG.materials.find((m) => m.thickness === 16)!

const board = (over: Partial<BoardSpec> = {}): BoardSpec => ({
  materialId: LDSP_16.id,
  length: 600,
  width: 450,
  orientation: ORIENT_HORIZONTAL,
  edges: { L1: { bandId: BAND_2MM.id }, L2: null, W1: null, W2: null },
  grainAlongLength: LDSP_16.hasGrain,
  role: 'custom',
  ...over,
})

const boardNode = (id: string, spec: BoardSpec, transform: Transform): SceneNode =>
  ({ kind: 'board', id, name: 'Столешница', transform, board: spec })

describe('flattenTree — еркін тақта', () => {
  it('бір Panel береді', () => {
    const scene = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0]!.panels).toHaveLength(1)
    expect(scene.nodes[0]!.hardware).toEqual([])
  })

  it('рез өлшемі кромкадан есептеледі (§4.3)', () => {
    // L1-де 2 мм кромка → cutWidth = 450 − 2 = 448; ұзындығы тимейді.
    const panel = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG).nodes[0]!.panels[0]!
    expect(panel.finishedLength).toBe(600)
    expect(panel.finishedWidth).toBe(450)
    expect(panel.cutLength).toBe(600)
    expect(panel.cutWidth).toBe(448)
  })

  it('0.4 мм кромка рез өлшемін ӨЗГЕРТПЕЙДІ (§4.3 minBandSubtract)', () => {
    const thin = SEED_CATALOG.edgeBands.find((b) => b.thickness === 0.4)!
    const spec = board({ edges: { L1: { bandId: thin.id }, L2: null, W1: null, W2: null } })
    const panel = flattenTree(root([boardNode('b1', spec, tr())]), SEED_CATALOG).nodes[0]!.panels[0]!
    expect(panel.cutWidth).toBe(450)
  })

  it('түйіннің аты — панельдің белгісі', () => {
    const panel = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG).nodes[0]!.panels[0]!
    expect(panel.label).toBe('Столешница')
    expect(panel.id).toBe('b1')
  })

  it('деталировкаға түседі', () => {
    const scene = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG)
    expect(scenePanels(scene)).toHaveLength(1)
  })

  it('жоқ материал — ConfigValidationError', () => {
    const spec = board({ materialId: 'yoq-material' })
    expect(() => flattenTree(root([boardNode('b1', spec, tr())]), SEED_CATALOG))
      .toThrow(ConfigValidationError)
  })
})
