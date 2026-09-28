import { describe, expect, it } from 'vitest'
import {
  IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, SEED_CATALOG, SEED_SETS,
  defaultShopProfile, flattenTree, generateCabinet, generateHardware,
  mergeProjectPanels, mergeSettings, nestPanels, nestingOptionsOf,
  parseProjectV4, priceProject, setToProject, treeFromProject,
} from '../src/core/index'
import type { BoardNode, GroupNode, ProjectFile } from '../src/core/index'
import { cutListToCsv } from '../src/core/export/csv'
import { cncFiles } from '../src/core/export/cnc'
import { cabinetToDxfFiles } from '../src/core/export/dxf'
import { projectProduction } from '../lib/projectProduction'
import { runShopExport } from '../lib/shopExport'
import { strFromU8, unzipSync } from 'fflate'
import { catalog, PVC2, referenceProject } from './fixtures'

describe('UI production uses the visible canonical scene', () => {
  it('keeps both cabinets and a free board in project CSV and DXF downloads', async () => {
    const file = parseProjectV4(referenceProject)
    const first = file.root.children.find((node) => node.kind === 'cabinet')
    if (!first || first.kind !== 'cabinet') throw new Error('Эталон корпус табылмады')
    file.root.children.push({ ...structuredClone(first), id: 'second-cabinet',
      config: { ...first.config, id: 'second-cabinet' } }, {
      kind: 'board', id: 'free-board', name: 'Еркін тақта', transform: IDENTITY_TRANSFORM,
      board: { materialId: catalog.materials[0]!.id, length: 600, width: 400,
        orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: true,
        edges: { L1: null, L2: null, W1: null, W2: null } },
    })
    const panels = projectProduction(file.root, flattenTree(file.root, catalog, file.settings)).panels
    expect(panels).toHaveLength(23)
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(23)

    let csv = ''
    await runShopExport('csv', { panels, catalog, exportId: 'whole-project' }, (_name, data) => {
      if (typeof data === 'string') csv = data
    })
    expect(csv.trim().split('\n').slice(1).reduce((qty, line) => qty + Number(line.split(',')[3]), 0)).toBe(23)

    let xlsx: Uint8Array | undefined
    await runShopExport('xlsx', { panels, catalog, exportId: 'whole-project' }, (_name, data) => {
      if (data instanceof Uint8Array) xlsx = data
    })
    expect(xlsx).toBeDefined()
    const sheetXml = Object.entries(unzipSync(xlsx!))
      .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .map(([, data]) => strFromU8(data))
    const xlsxPieces = sheetXml.flatMap((xml) => [...xml.matchAll(/<c r="B\d+" s="4"><v>(\d+)<\/v><\/c>/g)])
      .reduce((qty, match) => qty + Number(match[1]), 0)
    expect(xlsxPieces).toBe(23)

    let zip: Uint8Array | undefined
    await runShopExport('dxf', { panels, catalog, exportId: 'whole-project' }, (_name, data) => {
      if (data instanceof Uint8Array) zip = data
    })
    expect(zip).toBeDefined()
    expect(Object.keys(unzipSync(zip!)).filter((name) => name.endsWith('.dxf'))).toHaveLength(23)
  })
  it.each(SEED_SETS)('$id keeps legacy manufacturing and pricing results', (set) => {
    const { cabinets, placements } = setToProject(set, SEED_CATALOG)
    expect(cabinets.length).toBeGreaterThan(0)
    const file: ProjectFile = {
      schemaVersion: 3, name: set.name, materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands, room: set.room, cabinets, placements,
      settings: { shelfSetback: 8, outerFlipAxis: 'width' },
    }
    const root = treeFromProject(file)
    const actual = projectProduction(root, flattenTree(root, SEED_CATALOG, file.settings))
    const panels = mergeProjectPanels(cabinets.map((cabinet) => ({
      cabinetId: cabinet.id, panels: generateCabinet(cabinet, SEED_CATALOG, file.settings),
    })))
    const hardware = cabinets.flatMap((cabinet) => generateHardware(cabinet, SEED_CATALOG, file.settings))
    const widths = cabinets.map((cabinet) => cabinet.width)
    expect(actual.panels).toEqual(panels)
    expect(actual.hardware).toEqual(hardware)
    expect(actual.moduleWidths).toEqual(widths)
    expect(new Set(actual.panels.map((panel) => panel.id)).size).toBe(actual.panels.length)
    expect(cutListToCsv(actual.panels, SEED_CATALOG)).toBe(cutListToCsv(panels, SEED_CATALOG))
    const cncOptions = { projectName: file.name, outerFlipAxis: 'width' as const }
    expect(cncFiles(actual.panels, SEED_CATALOG, cncOptions)).toEqual(cncFiles(panels, SEED_CATALOG, cncOptions))
    const dxfOptions = { catalog: SEED_CATALOG, settings: mergeSettings(file.settings) }
    expect(cabinetToDxfFiles(actual.panels, dxfOptions)).toEqual(cabinetToDxfFiles(panels, dxfOptions))
    const shop = defaultShopProfile()
    const expectedNesting = nestPanels(panels, SEED_CATALOG, nestingOptionsOf(shop))
    const actualNesting = nestPanels(actual.panels, SEED_CATALOG, nestingOptionsOf(shop))
    expect(actualNesting).toEqual(expectedNesting)
    expect(priceProject(actual.panels, actualNesting, shop, actual.hardware, actual.moduleWidths))
      .toEqual(priceProject(panels, expectedNesting, shop, hardware, widths))
  })

  it('omits hidden groups/layers and solid boxes, includes a free board at cut size', () => {
    const file = parseProjectV4(referenceProject)
    const cabinet = file.root.children[0]!
    const board: BoardNode = {
      kind: 'board', id: 'board', name: 'Еркін тақта', transform: IDENTITY_TRANSFORM,
      board: { materialId: catalog.materials[0]!.id, length: 600, width: 400,
        orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: true,
        edges: { L1: { bandId: PVC2 }, L2: null, W1: null, W2: null } },
    }
    const root: GroupNode = { ...file.root, children: [cabinet, board,
      { kind: 'group', id: 'hidden-group', name: 'Жасырын', hidden: true,
        transform: IDENTITY_TRANSFORM, children: [{ ...cabinet, id: 'hidden-cabinet' }] },
      { ...cabinet, id: 'layer-cabinet', layerId: 'hidden-layer' },
      { kind: 'solid', id: 'solid', name: 'Декор', transform: IDENTITY_TRANSFORM,
        solid: { size: { x: 100, y: 100, z: 100 } } },
    ] }
    const scene = flattenTree(root, catalog, file.settings,
      [{ id: 'hidden-layer', name: 'Жасырын', visible: false, locked: false, color: '#000000' }])
    const result = projectProduction(root, scene)
    expect(result.panels).toHaveLength(12)
    expect(result.panels.filter((panel) => panel.label === board.name))
      .toMatchObject([{ cutLength: 600, cutWidth: 398 }])
    expect(result.moduleWidths).toEqual([referenceProject.cabinets[0]!.width])
    expect(result.hardware).toEqual(scene.nodes[0]!.hardware)
    expect(result.panels.some((panel) => /hidden|layer-cabinet|solid/.test(panel.id))).toBe(false)
  })

  it('an empty or hidden scene has no phantom panels, hardware or assembly width', () => {
    const file = parseProjectV4(referenceProject)
    const hidden = { ...file.root, hidden: true }
    expect(projectProduction(hidden, flattenTree(hidden, catalog)))
      .toEqual({ panels: [], hardware: [], moduleWidths: [], manualItems: [], specialParts: [] })
  })
})
