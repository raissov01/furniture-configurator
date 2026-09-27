import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SEED_CATALOG, flattenTree, nestPanels, nestingOptionsOf,
  parseProjectV4, priceProject, scenePanels, specialSolidSize, starterShopProfile } from '../src/core/index'
import { toPricedPublicProject, toProductionProject } from '../src/core/publicProject'
import { projectProduction } from '../lib/projectProduction'
import { priceSourceRows } from '../lib/priceSourceUi'
import { strFromU8, unzipSync } from 'fflate'
import { cutListToXlsx } from '../src/core/export/xlsx'
import { runShopExport } from '../lib/shopExport'
import type { BentSpec, GroupNode } from '../src/core/index'

const material = { ...SEED_CATALOG.materials[0]!, minBendRadiusMm: 50 }
const catalog = { ...SEED_CATALOG, materials: [material, ...SEED_CATALOG.materials.slice(1)] }
const spec: BentSpec = { kind: 'bent', chord: 100, radius: 100, height: 500, thickness: 10,
  referenceFace: 'inner', materialId: material.id, quantity: 2, unitPrice: 12500 }
const root: GroupNode = { kind: 'group', id: 'root', name: 'Жоба',
  transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [
    { kind: 'solid', id: 'bend-1', name: 'Иілген фасад', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      solid: { size: specialSolidSize(spec, 50), fabrication: spec } },
  ] }

describe('tree-backed special parts', () => {
  it('keeps bent parts in the cut-list section and out of Panel[], drilling and nesting', () => {
    const scene = flattenTree(root, catalog, DEFAULT_SETTINGS)
    const production = projectProduction(root, scene, catalog.materials)
    expect(scene.solids).toHaveLength(1)
    expect(scene.nodes).toHaveLength(0)
    expect(scenePanels(scene)).toEqual([])
    expect(production.panels).toEqual([])
    expect(production.hardware).toEqual([])
    expect(production.specialParts).toMatchObject([{ section: 'Иілген деталь', developedLength: 105, quantity: 2 }])
    const shop = { ...starterShopProfile(), materials: catalog.materials }
    const nesting = nestPanels(production.panels, catalog, nestingOptionsOf(shop))
    expect(nesting.sheetCount).toBe(0)
    expect(nesting.byMaterial).toHaveLength(0)
    const price = priceProject(production.panels, nesting, shop, [], [], undefined, production.specialParts)
    expect(price.hardware).toMatchObject([{ id: 'special-bend-1', cost: 25000,
      sources: [{ nodeId: 'bend-1', qty: 2, cost: 25000 }] }])
    expect(priceSourceRows(price.hardware[0]!)).toEqual([{ id: 'bend-1', qty: 2, cost: 25000 }])
    expect(price.goods).toBe(25000)
  })

  it('excludes hidden special parts and blocks a missing shop bend radius', () => {
    expect(flattenTree({ ...root, children: [{ ...root.children[0]!, hidden: true }] }, catalog).solids).toHaveLength(0)
    expect(() => flattenTree(root, SEED_CATALOG)).toThrow(/minBendRadiusMm/)
  })

  it('round-trips the canonical v4 tree without manufacturing panel data', () => {
    const raw = { schemaVersion: 4, name: 'Иілім', materials: catalog.materials,
      edgeBands: catalog.edgeBands, room: { width: 4000, height: 2700, depth: 3000 }, root }
    const restored = parseProjectV4(JSON.parse(JSON.stringify(raw)))
    expect(restored.root.children[0]).toMatchObject(root.children[0]!)
    expect(flattenTree(restored.root, catalog).nodes).toHaveLength(0)
    const broken = JSON.parse(JSON.stringify(raw))
    broken.root.children[0].solid.fabrication.radius = 0
    expect(() => parseProjectV4(broken)).toThrow()
    broken.root.children[0].solid.fabrication.radius = 100
    broken.root.children[0].solid.fabrication.angleDegrees = 60
    expect(() => parseProjectV4(broken)).toThrow()
  })

  it('exports special cut-list sections in XLSX without placing them on sheet material', () => {
    const scene = flattenTree(root, catalog)
    const parts = projectProduction(root, scene, catalog.materials).specialParts
    const files = unzipSync(cutListToXlsx([], catalog, 'Иілім', parts))
    const workbook = strFromU8(files['xl/workbook.xml']!)
    expect(workbook).toContain('Иілген деталь')
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('Иілген фасад')
    expect(sheet).toContain('105')
    expect(sheet).toContain('жеке иілу операциясы')
  })

  it('puts only the bent development in a special-only DXF archive', async () => {
    const scene = flattenTree(root, catalog)
    const parts = projectProduction(root, scene, catalog.materials).specialParts
    let bytes: Uint8Array | null = null
    await runShopExport('dxf', { panels: [], catalog, specialParts: parts }, (_name, data) => {
      if (!(data instanceof Uint8Array)) throw new Error('ZIP bytes қажет')
      bytes = data
    })
    if (!bytes) throw new Error('DXF архиві жасалмады')
    const files = unzipSync(bytes)
    expect(Object.keys(files)).toEqual(['BENT-bend-1-DEVELOPMENT.dxf'])
    expect(strFromU8(files['BENT-bend-1-DEVELOPMENT.dxf']!)).toContain('BENT_DEVELOPMENT')
  })

  it('includes special unit prices in the public total but strips those unit prices from shared JSON', () => {
    const project = parseProjectV4({ schemaVersion: 4, name: 'Иілім', materials: catalog.materials,
      edgeBands: catalog.edgeBands, room: { width: 4000, height: 2700, depth: 3000 }, root })
    const productionCopy = toProductionProject(project)
    const productionNode = productionCopy.root.children[0]
    expect(productionNode?.kind === 'solid' ? productionNode.solid.fabrication?.unitPrice : null).toBe(0)
    const shared = toPricedPublicProject(project, { ...starterShopProfile(), materials: catalog.materials })
    expect(shared.priceOverrides?.salePrice).toBe(25000)
    const publicNode = shared.root.children[0]
    expect(publicNode?.kind === 'solid' ? publicNode.solid.fabrication?.unitPrice : null).toBe(0)
  })
})
