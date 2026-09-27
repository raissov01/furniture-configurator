import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { SolidProperties } from '@/components/SolidProperties'
import { flattenTree, findNode } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('F09 decorative solid editor', () => {
  it('creates a selectable solid that never enters Panel[] and edits its dimensions, color and position', () => {
    const id = useConfigurator.getState().addSolid()
    expect(useConfigurator.getState().activeId).toBe(id)
    useConfigurator.getState().editSolid(id, { size: { x: 200, y: 300, z: 400 }, color: '#123456' })
    useConfigurator.getState().setSolidPosition(id, { x: 10, y: -20, z: 30 })
    const state = useConfigurator.getState()
    const node = findNode(state.root, id)
    expect(node?.kind).toBe('solid')
    if (node?.kind !== 'solid') return
    expect(node.solid).toMatchObject({ size: { x: 200, y: 300, z: 400 }, color: '#123456' })
    expect(node.transform.pos).toEqual({ x: 10, y: -20, z: 30 })
    const scene = flattenTree(state.root, state.catalog, state.projectSettings ?? state.shop.settings, state.layers)
    expect(scene.solids.some((item) => item.nodeId === id)).toBe(true)
    expect(scene.nodes.some((item) => item.nodeId === id)).toBe(false)
  })

  it('rejects fractional or missing sizes and invalid colors without changing the tree', () => {
    const id = useConfigurator.getState().addSolid()
    const before = useConfigurator.getState().root
    expect(() => useConfigurator.getState().editSolid(id, { size: { x: 100.5, y: 100, z: 100 } })).toThrow(/solid.size.x/)
    expect(() => useConfigurator.getState().editSolid(id, { size: { x: 0, y: 100, z: 100 } })).toThrow(/solid.size.x/)
    expect(() => useConfigurator.getState().editSolid(id, { color: 'red' })).toThrow(/solid.color/)
    expect(() => useConfigurator.getState().setSolidPosition(id, { x: 1.5, y: 0, z: 0 })).toThrow(/transform.pos.x/)
    expect(useConfigurator.getState().root).toBe(before)
  })

  it('shows size, placement and color controls for the selected solid', () => {
    const id = useConfigurator.getState().addSolid()
    const node = findNode(useConfigurator.getState().root, id)
    if (node?.kind !== 'solid') throw new Error('solid missing')
    const html = renderToStaticMarkup(createElement(SolidProperties, { node }))
    expect(html).toContain('data-testid="solid-dimensions"')
    expect(html).toContain('data-testid="solid-position"')
    expect(html).toContain('type="color"')
    expect(html).toContain('H, мм')
    expect(html).toContain('W, мм')
    expect(html).toContain('D, мм')
  })
})
