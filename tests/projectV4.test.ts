import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, findTemplate, flattenTree, generateCabinet, generateKitchen, migrateV3ToV4,
  parseProject, parseProjectV4, placementPose, scenePanels, templateToCabinet,
  ProjectFileV4Schema,
} from '../src/core/index'
import type { ProjectFile } from '../src/core/index'

const cabinet = (id: string) => ({
  ...templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG), id,
})

const legacy: ProjectFile = {
  schemaVersion: 3,
  name: 'Клиент жобасы',
  materials: SEED_CATALOG.materials,
  edgeBands: SEED_CATALOG.edgeBands,
  cabinets: [cabinet('placed'), cabinet('unplaced')],
  room: { width: 4000, depth: 3000, height: 2700 },
  placements: [{ cabinetId: 'placed', wall: 'east', offset: 500, elevation: 700, rotate: 15 }],
  settings: { shelfSetback: 12 },
  info: { client: 'Бекназар', orderNo: '24' },
  priceOverrides: { coefficient: 2, salePrice: 500_000 },
}

const plainBoardNode = () => ({
  kind: 'board', id: 'b1', name: 'Еркін тақта',
  transform: { pos: { x: 10, y: 20, z: 30 }, rot: { x: 0, y: 90, z: 0 } },
  board: {
    materialId: SEED_CATALOG.materials[0]!.id, length: 600, width: 300,
    orientation: { length: 'x', width: 'z', thickness: 'y' },
    edges: { L1: null, L2: null, W1: null, W2: null },
    grainAlongLength: true, role: 'custom',
    drilling: [{ face: 'inner', x: 10, y: 20, diameter: 5, depth: 8, purpose: 'shelfPin' }],
  },
})

describe('v3 → v4 root миграциясы', () => {
  it('ортақ ас үй цоколі v4 JSON арқылы панельдер мен кесу өлшемдерін сақтайды', () => {
    const kitchen = generateKitchen({ layout: 'straight', lengthA: 2800, upper: false,
      sink: false, appliances: false, hob: 'none' }, SEED_CATALOG)
    const project = migrateV3ToV4({ ...legacy, cabinets: kitchen.cabinets,
      placements: kitchen.placements, room: kitchen.room })
    const before = scenePanels(flattenTree(project.root, SEED_CATALOG, project.settings))
    const after = parseProjectV4(JSON.parse(JSON.stringify(project)))
    const restored = scenePanels(flattenTree(after.root, SEED_CATALOG, after.settings))
    expect(restored.map((p) => [p.id, p.cutLength, p.cutWidth])).toEqual(
      before.map((p) => [p.id, p.cutLength, p.cutWidth]),
    )
    expect(restored.filter((p) => p.role === 'plinth')).toHaveLength(
      before.filter((p) => p.role === 'plinth').length,
    )
  })

  it('ескі файлдағы қайталанған секция id-лерін жоғалтпай түзетеді', () => {
    const raw = structuredClone(migrateV3ToV4(legacy))
    const node = raw.root.children[0]
    if (node?.kind !== 'cabinet') throw new Error('cabinet қажет')
    node.config.sections = [
      { id: 's1', widthMode: 'flex', contents: [] },
      { id: 's3', widthMode: 'flex', contents: [] },
      { id: 's3', widthMode: 'flex', contents: [] },
    ]
    expect(ProjectFileV4Schema.safeParse(raw).success).toBe(false)
    const fixed = parseProjectV4(raw)
    const fixedNode = fixed.root.children[0]
    if (fixedNode?.kind !== 'cabinet') throw new Error('cabinet қажет')
    expect(fixedNode.config.sections.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
    expect(node.config.sections.map((s) => s.id)).toEqual(['s1', 's3', 's3'])
    expect(ProjectFileV4Schema.safeParse(fixed).success).toBe(true)
  })

  it('v3 файлдан өткенде де қайталанған секция id-лерін түзетеді', () => {
    const raw = structuredClone(legacy)
    raw.cabinets[0]!.sections = [
      { id: 's1', widthMode: 'flex', contents: [] },
      { id: 's3', widthMode: 'flex', contents: [] },
      { id: 's3', widthMode: 'flex', contents: [] },
    ]
    const fixed = parseProjectV4(raw)
    const node = fixed.root.children[0]
    if (node?.kind !== 'cabinet') throw new Error('cabinet қажет')
    expect(node.config.sections.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
    expect(raw.cabinets[0]!.sections.map((s) => s.id)).toEqual(['s1', 's3', 's3'])
  })
  it('орналасқан шкафтың панелі, фурнитурасы және позасы өзгермейді', () => {
    const migrated = migrateV3ToV4(legacy)
    const scene = flattenTree(migrated.root, SEED_CATALOG, migrated.settings)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0]!.panels).toEqual(generateCabinet(legacy.cabinets[0]!, SEED_CATALOG, legacy.settings))
    expect(scene.nodes[0]!.pose).toEqual({
      position: { x: 3550, y: 700, z: 2500 }, rotationY: 105,
    })
    expect(scenePanels(scene)).toEqual(scene.nodes[0]!.panels)
  })

  it('орны жоқ шкафтың конфигін hidden түйінде жоғалтпай сақтайды', () => {
    const migrated = migrateV3ToV4(legacy)
    const unplaced = migrated.root.children.find((node) => node.id === 'unplaced')
    expect(unplaced).toMatchObject({ kind: 'cabinet', hidden: true, config: legacy.cabinets[1] })
    expect(flattenTree(migrated.root, SEED_CATALOG, migrated.settings).nodes.map((node) => node.nodeId))
      .toEqual(['placed'])
  })

  it('info, priceOverrides, layers сақталады; cabinets/placements қалмайды', () => {
    const raw = { ...legacy, layers: [{ id: 'l1', name: 'Қабат', visible: true, locked: false, color: '#ffffff' }] }
    const migrated = parseProjectV4(JSON.parse(JSON.stringify(raw)))
    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.info).toEqual(legacy.info)
    expect(migrated.priceOverrides).toEqual(legacy.priceOverrides)
    expect(migrated.layers).toEqual(raw.layers)
    expect('cabinets' in migrated).toBe(false)
    expect('placements' in migrated).toBe(false)
  })

  it('v4 JSON қайта оқылады, еркін тақтаның кесу ережесі мен барлық өрісі сақталады', () => {
    const migrated = migrateV3ToV4(legacy)
    migrated.root.children.push({
      kind: 'board', id: 'b1', name: 'Еркін тақта',
      transform: { pos: { x: 10, y: 20, z: 30 }, rot: { x: 0, y: 90, z: 0 } },
      board: {
        materialId: SEED_CATALOG.materials[0]!.id,
        length: 600, width: 300,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: { bandId: SEED_CATALOG.edgeBands.find((b) => b.thickness === 2)!.id }, W2: { bandId: SEED_CATALOG.edgeBands.find((b) => b.thickness === 2)!.id } },
        grainAlongLength: true, veneerGroup: 'facade-pair', role: 'custom',
        drilling: [{ face: 'inner', x: 10, y: 20, diameter: 5, depth: 8, purpose: 'shelfPin' }],
        cutouts: [{ shape: 'circle', id: 'hole', corner: 'bottomLeft', x: 50, y: 50, diameter: 20 }],
        corners: { bottomLeft: 0, bottomRight: 0, topRight: 0, topLeft: 0 },
        milling: [{ points: [{ x: 5, y: 5 }, { x: 20, y: 5 }], closed: false }],
      },
    })
    const round = parseProjectV4(JSON.parse(JSON.stringify(migrated)))
    expect(round).toEqual(migrated)
    expect(flattenTree(round.root, SEED_CATALOG).nodes.at(-1)!.panels[0]!.cutLength).toBe(596)
    expect(flattenTree(round.root, SEED_CATALOG).nodes.at(-1)!.panels[0]!.veneerGroup).toBe('facade-pair')
  })

  it('жарамсыз түйін мен қолмен жазылған cutLength өтпейді', () => {
    const migrated = migrateV3ToV4(legacy)
    const bad = { ...migrated, root: { ...migrated.root, children: [{ kind: 'unsupported', id: 'bad', name: 'bad', transform: migrated.root.transform }] } }
    expect(() => parseProjectV4(bad)).toThrow()
    const boardNode = {
      kind: 'board', id: 'b1', name: 'Еркін тақта', transform: migrated.root.transform,
      board: { materialId: SEED_CATALOG.materials[0]!.id, length: 600, width: 300,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null },
        grainAlongLength: true, role: 'custom', cutLength: 600 },
    }
    expect(() => parseProjectV4({ ...migrated, root: { ...migrated.root, children: [boardNode] } })).toThrow()
    const validBoard = plainBoardNode()
    expect(() => parseProjectV4({ ...migrated, root: { ...migrated.root, children: [
      { ...validBoard, board: { ...validBoard.board, veneerGroup: '  ' } },
    ] } })).toThrow()
    expect(() => parseProjectV4({ ...migrated, cabinets: legacy.cabinets })).toThrow()
  })

  it('v1 және v2 үлгі жобаларын да v4-ке панель жоғалтпай көтереді', () => {
    for (const filename of ['wardrobe-v1.json', 'wardrobe-3section.json']) {
      const raw: unknown = JSON.parse(readFileSync(fileURLToPath(new URL(`../examples/${filename}`, import.meta.url)), 'utf8'))
      const migrated = parseProjectV4(raw)
      const old = parseProject(raw)
      expect(migrated.schemaVersion).toBe(4)
      expect(migrated.root.children.length).toBeGreaterThan(0)
      const catalog = { materials: migrated.materials, edgeBands: migrated.edgeBands }
      const scene = flattenTree(migrated.root, catalog, migrated.settings)
      const oldPlaced = old.cabinets.filter((cabinet) => old.placements.some((p) => p.cabinetId === cabinet.id))
      expect(scene.nodes).toHaveLength(oldPlaced.length)
      for (const cabinet of oldPlaced) {
        const node = scene.nodes.find((item) => item.nodeId === cabinet.id)!
        const placement = old.placements.find((p) => p.cabinetId === cabinet.id)!
        expect(node.panels).toEqual(generateCabinet(cabinet, catalog, old.settings))
        expect(node.pose).toEqual(placementPose(old.room, cabinet, placement))
      }
      expect(scenePanels(scene)).toEqual(oldPlaced.flatMap((cabinet) => generateCabinet(cabinet, catalog, old.settings)))
    }
  })

  it('v4 тек Y бұрылысын және төрт өндірістік бағдарды қабылдайды', () => {
    const migrated = migrateV3ToV4(legacy)
    const board = plainBoardNode()
    expect(() => parseProjectV4({ ...migrated, root: { ...migrated.root,
      children: [{ ...board, transform: { ...board.transform, rot: { x: 10, y: 0, z: 0 } } }] } })).toThrow()
    expect(() => parseProjectV4({ ...migrated, root: { ...migrated.root,
      children: [{ ...board, board: { ...board.board, orientation: { length: 'x', width: 'x', thickness: 'x' } } }] } })).toThrow()
  })

  it('v4-те түбірді қоса барлық түйін id-лері бірегей, v3-тегі root атты шкаф сақталады', () => {
    const migrated = migrateV3ToV4(legacy)
    const board = plainBoardNode()
    expect(() => parseProjectV4({ ...migrated, root: { ...migrated.root,
      children: [board, { ...board, name: 'Көшірме' }] } })).toThrow()
    expect(() => parseProjectV4({ ...migrated, root: { ...migrated.root,
      children: [{ ...board, id: migrated.root.id }] } })).toThrow()
    const rootCabinet = { ...legacy, cabinets: [cabinet('root')],
      placements: [{ cabinetId: 'root', wall: 'south' as const, offset: 0 }] }
    const round = parseProjectV4(rootCabinet)
    expect(round.root.id).not.toBe('root')
    expect(round.root.children.map((node) => node.id)).toEqual(['root'])
  })

  it('бұрғы диаметрі/тереңдігі бүтін; тек ілгек cup 12.5 мм рұқсат', () => {
    const migrated = migrateV3ToV4(legacy)
    const board = plainBoardNode()
    const withDrill = (diameter: number, depth: number, purpose: string) => ({ ...migrated,
      root: { ...migrated.root, children: [{ ...board, board: { ...board.board,
        drilling: [{ face: 'inner', x: 22, y: 20, diameter, depth, purpose }] } }] } })
    expect(() => parseProjectV4(withDrill(5.5, 8, 'shelfPin'))).toThrow()
    expect(() => parseProjectV4(withDrill(2.8, 8, 'hinge'))).toThrow()
    const fractional = withDrill(5, 8, 'shelfPin')
    fractional.root.children[0]!.board.drilling[0]!.x = 22.5
    expect(() => parseProjectV4(fractional)).toThrow()
    expect(() => parseProjectV4(withDrill(5, 8.5, 'shelfPin'))).toThrow()
    expect(() => parseProjectV4(withDrill(5, 12.5, 'shelfPin'))).toThrow()
    expect(() => parseProjectV4(withDrill(35, 12.5, 'hinge'))).not.toThrow()
  })
})
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
