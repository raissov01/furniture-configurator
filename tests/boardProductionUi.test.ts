import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cabinetToDxfFiles, findNode, flattenTree, mergeSettings, nestPanels, parseProjectV4, priceProject } from '../src/core/index'
import { projectProduction } from '../lib/projectProduction'
import { BoardProperties } from '../components/BoardProperties'
import { useConfigurator } from '../store/configurator'
import { PVC2, referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
const s = () => useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('таңдалған еркін тақта: бір panel барлық өнім жолына өтеді', () => {
  it('Properties, деталировка, раскрой, смета және DXF бір cut өлшемін көреді', () => {
    const file = parseProjectV4(referenceProject)
    file.root.children = []
    s().loadProject(file)
    const id = s().addBoard()
    s().editBoard(id, { length: 600, width: 400,
      edges: { L1: { bandId: PVC2 }, L2: null, W1: { bandId: PVC2 }, W2: { bandId: PVC2 } },
      drilling: [{ face: 'inner', x: 30, y: 30, diameter: 5, depth: 8, purpose: 'shelfPin' }] })
    const node = findNode(s().root, id)
    if (node?.kind !== 'board') throw new Error('board required')
    const scene = flattenTree(s().root, s().catalog, s().projectSettings ?? s().shop.settings, s().layers)
    const production = projectProduction(s().root, scene)
    expect(production.panels).toHaveLength(1)
    const panel = scene.nodes[0]!.panels[0]!
    expect(panel).toMatchObject({ finishedLength: 600, finishedWidth: 400, cutLength: 596, cutWidth: 398 })
    const html = renderToStaticMarkup(createElement(BoardProperties, { node, panel, catalog: s().catalog }))
    expect(html).toContain('data-testid="board-properties"')
    expect(html).toContain('596 × 398')
    expect(html).toContain('Экспорт')
    const nesting = nestPanels(production.panels, s().catalog)
    expect(nesting.sheetCount).toBeGreaterThan(0)
    const price = priceProject(production.panels, nesting, s().shop, production.hardware, production.moduleWidths)
    expect(price.materials.length).toBeGreaterThan(0)
    const dxf = cabinetToDxfFiles(production.panels, { catalog: s().catalog, settings: mergeSettings(s().shop.settings) })
    expect([...dxf.values()].join('\n')).toContain('CIRCLE')
  })

  it('board-only жобада қол тесігі v4 арқылы сақталып, DXF-ке өтеді', () => {
    const file = parseProjectV4(referenceProject)
    file.root.children = []
    s().loadProject(file)
    const id = s().addBoard()
    s().editBoard(id, { drilling: [{ face: 'inner', x: 30, y: 30, diameter: 5, depth: 8, purpose: 'shelfPin' }] })
    const restored = parseProjectV4(s().exportProject())
    const scene = flattenTree(restored.root, s().catalog, restored.settings ?? s().shop.settings, restored.layers)
    expect(scene.nodes[0]?.panels[0]?.drilling).toHaveLength(1)
    expect([...cabinetToDxfFiles(scene.nodes[0]!.panels, { catalog: s().catalog, settings: mergeSettings(s().shop.settings) }).values()].join('\n'))
      .toContain('CIRCLE')
  })
})
