/**
 * Мақсат: қолданба ашылғанда тұратын шкаф (жаңа цех, нарық бағасы) тақтада
 * «Цены не заданы» деп тұрмауы керек — смета жолдарының бәрінде баға бар.
 */
import { describe, expect, it } from 'vitest'
import { defaultCabinet, defaultShop } from '../lib/defaults'
import { projectProduction } from '../lib/projectProduction'
import {
  DEFAULT_ROOM, catalogOf, flattenTree, nestPanels, nestingOptionsOf, priceProject, treeFromProject,
} from '../src/core/index'
import { createDefaultLayer } from '../src/core/layers'

describe('әдепкі шкаф жаңа цехта', () => {
  it('бағасы жоқ позиция жоқ — тақтада сома көрінеді', () => {
    const root = treeFromProject({
      schemaVersion: 3, name: defaultCabinet.name, room: DEFAULT_ROOM,
      materials: defaultShop.materials, edgeBands: defaultShop.edgeBands, cabinets: [defaultCabinet],
      placements: [{ cabinetId: defaultCabinet.id, wall: 'south', offset: 0 }],
    })
    const catalog = catalogOf(defaultShop)
    const scene = flattenTree(root, catalog, defaultShop.settings, [createDefaultLayer()], [])
    const production = projectProduction(root, scene)
    const nesting = nestPanels(production.panels, catalog, nestingOptionsOf(defaultShop))
    const price = priceProject(production.panels, nesting, defaultShop, production.hardware, production.moduleWidths)
    expect(price.missingPrices).toEqual([])
    expect(price.total).toBeGreaterThan(0)
  })
})
