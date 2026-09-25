import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Workspace } from '../components/Workspace'
import { PropertiesDialog } from '../components/PropertiesDialog'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const original = useConfigurator.getState().exportProject()
const initialSnapshot = useConfigurator.getInitialState()
const originalInitialSnapshot = { ...initialSnapshot }
afterEach(() => { Object.assign(initialSnapshot, originalInitialSnapshot); useConfigurator.getState().loadProject(original) })

describe('classic desktop workspace', () => {
  it('defaults to the classic shell with camera and a labelled H × W × D status', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const id = useConfigurator.getState().activeId
    useConfigurator.getState().setSelected(id)
    Object.assign(initialSnapshot, useConfigurator.getState())
    const html = renderToString(createElement(Workspace))
    expect(html).toContain('data-workspace-style="classic"')
    expect(html).toContain('Камера 1')
    expect(html).toContain('data-testid="p100-status"')
    expect(html).toContain('(H) ×')
    expect(html).toContain('(W) ×')
    expect(html).toContain('(D)')
  })

  it('presents Lock, dimensions and real transaction controls around the shared editor', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const state = useConfigurator.getState()
    Object.assign(initialSnapshot, state)
    const html = renderToString(createElement(PropertiesDialog, {
      nodeId: state.activeId, catalog: state.catalog, panels: [], error: null, onClose: () => undefined,
    }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Заблокировать')
    expect(html).toContain('Показывать размеры')
    expect(html).toContain('Применить')
    expect(html).toContain('Отмена')
    expect(html).toContain('Производство')
  })
})
