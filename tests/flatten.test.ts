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
  ConfigValidationError, ORIENT_HORIZONTAL, ORIENT_FACING, rotationFor,
} from '../src/core/index'
import type {
  CabinetConfig, GroupNode, SceneNode, Transform, BoardSpec, Panel,
  Drill, Cutout, PanelCorners, MillingPath,
} from '../src/core/index'

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
  it('rejects zero or negative cut sizes after edge subtraction', () => {
    for (const length of [1, 4]) {
      const spec = board({ length, edges: {
        L1: null, L2: null, W1: { bandId: BAND_2MM.id }, W2: { bandId: BAND_2MM.id },
      } })
      expect(() => flattenTree(root([boardNode('tiny', spec, tr())]), SEED_CATALOG))
        .toThrow(/board\[tiny\].cutLength/)
    }
    const narrow = board({ width: 1 })
    expect(() => flattenTree(root([boardNode('narrow', narrow, tr())]), SEED_CATALOG))
      .toThrow(/board\[narrow\].cutWidth/)
  })

  it('reports a missing edge band with its board field instead of a raw error', () => {
    const spec = board({ edges: { L1: { bandId: 'missing' }, L2: null, W1: null, W2: null } })
    try {
      flattenTree(root([boardNode('unknown-edge', spec, tr())]), SEED_CATALOG)
      throw new Error('expected validation failure')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError)
      expect((error as ConfigValidationError).field).toBe('board[unknown-edge].edges.L1.bandId')
    }
  })

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

  it('барлық ерікті өрісі толтырылған BoardSpec — Panel ТОЛЫҚ шығады', () => {
    // Мутация тестінде boardPanel-дің 12 бұрмалауы бірде-бір тестпен
    // ұсталмаған (drilling/cutouts/milling жоғалуы, qty еселенуі,
    // grainAlongLength теріске шығуы, т.б.). Бір толық toEqual бәрін бірден
    // ұстау үшін — ЕРІКТІ өрістің бәрі толтырылған, ешбір мән бос/әдепкі емес.
    const drilling: Drill[] = [
      { face: 'inner', x: 50, y: 60, diameter: 8, depth: 13, purpose: 'shelfPin' },
    ]
    const cutouts: Cutout[] = [
      { id: 'cut1', label: 'Раковина', corner: 'bottomLeft', x: 100, y: 80, shape: 'rect', width: 500, height: 400 },
    ]
    const corners: PanelCorners = { bottomLeft: 20, bottomRight: 0, topRight: 20, topLeft: 0 }
    const milling: MillingPath[] = [
      { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], closed: true },
    ]
    // Материалдың өз hasGrain-інен ӘДЕЙІ өзгеше, сонда "материалдан алынып
    // жатыр ма" деген қате де (grainAlongLength: material.hasGrain) ұсталады.
    const grainAlongLength = !LDSP_16.hasGrain
    const spec = board({
      length: 600,
      width: 450,
      orientation: ORIENT_FACING,
      edges: { L1: { bandId: BAND_2MM.id }, L2: { bandId: BAND_2MM.id }, W1: { bandId: BAND_2MM.id }, W2: { bandId: BAND_2MM.id } },
      grainAlongLength,
      role: 'shelf',
      drilling,
      cutouts,
      corners,
      milling,
    })
    // minBandSubtract-ты 3-ке көтеремін: 2 мм кромка ЕНДІ шегерілмейді.
    // Мұны flattenTree-ге ОВЕРРАЙД ретінде беремін — сонда `mergeSettings(settings)`
    // шақыруы (аргументсіз `mergeSettings()`-ке бұрмаланса) ӨЗГЕШЕ нәтиже беруі
    // керек: бұрмаланса, әдепкі minBandSubtract=1 қолданылып, кромка шегеріле
    // береді де, cutLength/cutWidth 596/446 болып қалады, тест құлайды.
    const panel = flattenTree(
      root([boardNode('b1', spec, tr())]), SEED_CATALOG, { minBandSubtract: 3 },
    ).nodes[0]!.panels[0]!

    const expected: Panel = {
      id: 'b1',
      role: 'shelf',
      label: 'Столешница',
      materialId: LDSP_16.id,
      finishedLength: 600,
      finishedWidth: 450,
      // minBandSubtract=3 > 2 мм кромка → ЕШҚАЙСЫСЫ шегерілмейді:
      // cutLength = finishedLength = 600, cutWidth = finishedWidth = 450.
      cutLength: 600,
      cutWidth: 450,
      edges: spec.edges,
      grainAlongLength,
      qty: 1,
      position: { x: 0, y: 0, z: 0 },
      rotation: rotationFor(ORIENT_FACING),
      orientation: ORIENT_FACING,
      note: '',
      drilling,
      cutouts,
      grooves: [],
      milling,
      corners,
    }
    expect(panel).toEqual(expected)
  })
})

const solidNode = (id: string, transform: Transform): SceneNode =>
  ({ kind: 'solid', id, name: 'Тоңазытқыш', transform, solid: { size: { x: 600, y: 1800, z: 600 } } })

describe('flattenTree — декор қорап', () => {
  it('деталировкаға ТҮСПЕЙДІ', () => {
    const scene = flattenTree(root([solidNode('s1', tr())]), SEED_CATALOG)
    expect(scenePanels(scene)).toEqual([])
    expect(scene.nodes).toEqual([])
  })

  it('solids тізімінде позасымен тұрады', () => {
    const scene = flattenTree(root([solidNode('s1', tr(1200, 0, 0))]), SEED_CATALOG)
    expect(scene.solids).toHaveLength(1)
    expect(scene.solids[0]!.pose.position.x).toBe(1200)
    expect(scene.solids[0]!.spec.size.y).toBe(1800)
  })
})

describe('flattenTree — hidden', () => {
  it('жасырылған корпус деталировкаға түспейді', () => {
    const node = cabinetNode('c1', cab(), tr())
    const scene = flattenTree(root([{ ...node, hidden: true }]), SEED_CATALOG)
    expect(scene.nodes).toEqual([])
  })

  it('жасырылған топтың БАЛАЛАРЫ да түспейді', () => {
    const inner: GroupNode = {
      kind: 'group', id: 'g1', name: 'Қатар', transform: tr(), hidden: true,
      children: [cabinetNode('c1', cab(), tr()), solidNode('s1', tr())],
    }
    const scene = flattenTree(root([inner]), SEED_CATALOG)
    expect(scene.nodes).toEqual([])
    expect(scene.solids).toEqual([])
  })

  it('жасырылған тақта да түспейді', () => {
    const node = boardNode('b1', board(), tr())
    const scene = flattenTree(root([{ ...node, hidden: true }]), SEED_CATALOG)
    expect(scenePanels(scene)).toEqual([])
  })

  it('көрінетін көршісі қалады', () => {
    const hiddenCab = { ...cabinetNode('c1', cab(), tr()), hidden: true }
    const scene = flattenTree(root([hiddenCab, cabinetNode('c2', cab(), tr(600, 0, 0))]), SEED_CATALOG)
    expect(scene.nodes.map((n) => n.nodeId)).toEqual(['c2'])
  })
})
