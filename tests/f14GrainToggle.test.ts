import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { grainDirectionUi } from '../lib/grainDirectionUi'
import { BoardProperties } from '../components/BoardProperties'
import { findNode } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('F14 board grain control', () => {
  it('disables direction for material without grain and explains why', () => {
    expect(grainDirectionUi(false)).toMatchObject({ disabled: true })
    const id = useConfigurator.getState().addBoard()
    const state = useConfigurator.getState()
    const node = findNode(state.root, id)
    if (node?.kind !== 'board') throw new Error('board required')
    const material = state.catalog.materials.find((item) => !item.hasGrain)
    if (!material) throw new Error('grain-free material required')
    const html = renderToStaticMarkup(createElement(BoardProperties, {
      node: { ...node, board: { ...node.board, materialId: material.id } }, panel: undefined, catalog: state.catalog,
    }))
    expect(html).toMatch(/type="checkbox"[^>]*disabled=""/)
    expect(html).toContain('У материала нет направления текстуры')
  })

  it('leaves direction editable for a grained decor', () => {
    expect(grainDirectionUi(true)).toMatchObject({ disabled: false })
  })
})
