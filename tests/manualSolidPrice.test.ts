import { afterEach, expect, it } from 'vitest'
import { nestPanels, priceProject } from '../src/core/index'
import { parseProjectV4 } from '../src/core/projectV4'
import { projectProduction } from '../lib/projectProduction'
import { useConfigurator } from '../store/configurator'
import { flattenTree } from '../src/core/flatten'
import { toPublicProject } from '../src/core/publicProject'
import { findNode } from '../src/core/tree'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

it('solid қолмен қойылған бағасы сметаға түйін көзімен кіреді және v4 сақталады', () => {
  const id = useConfigurator.getState().addSolid()
  useConfigurator.getState().editSolid(id, { manualPriceTiyn: 123_456 })
  const state = useConfigurator.getState()
  const saved = parseProjectV4(state.exportProject())
  const scene = flattenTree(saved.root, state.catalog, state.projectSettings ?? state.shop.settings, state.layers)
  const production = projectProduction(saved.root, scene)
  expect(production.manualItems).toEqual([{ nodeId: id, name: expect.any(String), priceTiyn: 123_456 }])
  const nesting = nestPanels(production.panels, state.catalog)
  const withPrice = priceProject(production.panels, nesting, state.shop,
    production.hardware, production.moduleWidths, undefined, production.manualItems)
  const withoutPrice = priceProject(production.panels, nesting, state.shop,
    production.hardware, production.moduleWidths)
  expect(withPrice.manualItems).toEqual([expect.objectContaining({
    cost: 123_456, sources: [{ nodeId: id, qty: 1, cost: 123_456 }],
  })])
  expect(withPrice.goods - withoutPrice.goods).toBe(123_456)
  expect(withPrice.total).toBeGreaterThan(withoutPrice.total)
  const publicCopy = toPublicProject(saved, withPrice.total)
  const publicSolid = findNode(publicCopy.root, id)
  expect(publicSolid?.kind === 'solid' ? publicSolid.solid.manualPriceTiyn : undefined).toBeUndefined()
  expect(publicCopy.priceOverrides?.salePrice).toBe(withPrice.total)
  expect(() => useConfigurator.getState().editSolid(id, { manualPriceTiyn: -1 })).toThrow(/manualPriceTiyn/)
})

it('декор мен арнайы детальдың бағасын екеуін де бір рет санайды', () => {
  const state = useConfigurator.getState()
  const nesting = nestPanels([], state.catalog)
  const price = priceProject([], nesting, state.shop, [], [], undefined,
    [{ nodeId: 'decor-1', name: 'Decor', priceTiyn: 1_200 }],
    [{ nodeId: 'lathe-1', section: 'Токарлық бұйым', name: 'Leg', materialId: state.catalog.materials[0]!.id,
      materialName: 'Board', quantity: 2, height: 420, maxDiameter: 40,
      operation: 'токарлық операция', unitPrice: 3_400 }])
  expect(price.manualItems).toEqual([expect.objectContaining({ cost: 1_200 })])
  expect(price.hardware).toContainEqual(expect.objectContaining({ id: 'special-lathe-1', cost: 6_800 }))
  expect(price.goods).toBe(8_000)
})

it('арнайы детальдың ішіндегі ескі декор бағасы қосылмайды және ашық көшірмеде екі баға да жасырылған', () => {
  const id = useConfigurator.getState().addSpecialPart('lathe')
  const node = findNode(useConfigurator.getState().root, id)
  if (node?.kind !== 'solid' || !node.solid.fabrication) throw new Error('lathe solid missing')
  useConfigurator.getState().editSolid(id, { manualPriceTiyn: 999_999,
    fabrication: { ...node.solid.fabrication, unitPrice: 3_400 } })
  const state = useConfigurator.getState()
  const saved = parseProjectV4(state.exportProject())
  const scene = flattenTree(saved.root, state.catalog, state.projectSettings ?? state.shop.settings, state.layers)
  const production = projectProduction(saved.root, scene, state.catalog.materials)
  expect(production.manualItems).toEqual([])
  expect(production.specialParts).toHaveLength(1)
  const publicCopy = toPublicProject(saved)
  const publicNode = findNode(publicCopy.root, id)
  expect(publicNode?.kind === 'solid' ? publicNode.solid.manualPriceTiyn : undefined).toBeUndefined()
  expect(publicNode?.kind === 'solid' ? publicNode.solid.fabrication?.unitPrice : undefined).toBe(0)
})
