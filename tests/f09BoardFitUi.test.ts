import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BoardProperties } from '@/components/BoardProperties'
import { flattenTree, findNode } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

describe('F09 board sheet warning', () => {
  it('shows the sheet fit warning beside an oversized free board without rejecting its size', () => {
    const id = useConfigurator.getState().addBoard()
    useConfigurator.getState().editBoard(id, { length: 10000 })
    const state = useConfigurator.getState()
    const node = findNode(state.root, id)
    if (node?.kind !== 'board') throw new Error('board missing')
    const panel = flattenTree(state.root, state.catalog, state.projectSettings ?? state.shop.settings, state.layers)
      .nodes.find((entry) => entry.nodeId === id)?.panels[0]
    expect(panel).toBeDefined()
    const html = renderToStaticMarkup(createElement(BoardProperties, { node, panel, catalog: state.catalog }))
    expect(html).toContain('не помещается на лист')
    expect(html).toContain('10000')
  })
})
