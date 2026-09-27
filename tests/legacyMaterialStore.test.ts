import { afterEach, expect, it } from 'vitest'
import { BASIS_MATERIALS, catalogOf, defaultShopProfile, flattenTree, nestPanels, parseProjectV4,
  priceProject, scenePanels } from '../src/core/index'
import { LEGACY_MATERIAL_ALIASES } from '../src/core/data/catalog/materials'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()
afterEach(() => useConfigurator.setState(initial, true))

it.each(['basis price', 'own alias price'] as const)('%s сақталған баға мен жеңілдікті сақтайды', (source) => {
  const oldId = 'basis-ldsp-LDSP-16-H1145-ST10'
  const targetId = LEGACY_MATERIAL_ALIASES[oldId]!
  const material = BASIS_MATERIALS.find((m) => m.id === oldId)!
  const shop = defaultShopProfile('legacy-price-test')
  shop.materials = [...shop.materials, { ...material, id: source === 'basis price' ? oldId : targetId, pricePerSheet: 3_400_000 }]
  useConfigurator.setState({ shop, catalog: catalogOf(shop) })
  const raw = {
    schemaVersion: 4, name: 'Ескі жоба', materials: [material], edgeBands: [],
    room: { width: 4000, depth: 3000, height: 2700 }, lights: [], autoJoints: [],
    root: { kind: 'group', id: 'root', name: 'root', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      children: [{ kind: 'board', id: 'board', name: 'Тақта', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
        board: { materialId: oldId, length: 600, width: 300, orientation: { length: 'x', width: 'z', thickness: 'y' },
          edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }] },
    priceOverrides: { lineDiscounts: { [`materials:${oldId}`]: { kind: 'percent', value: 10 } } },
  }
  useConfigurator.getState().loadProject(raw)
  const state = useConfigurator.getState()
  const saved = state.exportProject()
  expect(saved.materials.some((m) => m.id === oldId)).toBe(true)
  expect(saved.priceOverrides?.lineDiscounts?.[`materials:${oldId}`]).toEqual({ kind: 'percent', value: 10 })
  expect(state.catalog.materials.find((m) => m.id === oldId)?.pricePerSheet).toBe(3_400_000)
  const panels = scenePanels(flattenTree(saved.root, state.catalog, saved.settings, saved.layers))
  const bill = priceProject(panels, nestPanels(panels, state.catalog), state.shop, [], [], saved.priceOverrides)
  expect(bill.materials.find((line) => line.id === oldId)?.unitPrice).toBe(3_400_000)
  expect(bill.materials.find((line) => line.id === oldId)?.discountAmount).toBeGreaterThan(0)
  expect(parseProjectV4(saved, { migrateMaterials: false }).materials.some((m) => m.id === oldId)).toBe(true)
})
