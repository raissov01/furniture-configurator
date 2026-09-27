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
