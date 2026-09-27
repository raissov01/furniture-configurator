import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { Workspace } from '../components/Workspace'
import { PropertiesDialog } from '../components/PropertiesDialog'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const original = useConfigurator.getState().exportProject()
const initialSnapshot = useConfigurator.getInitialState()
const originalInitialSnapshot = { ...initialSnapshot }
afterEach(() => { Object.assign(initialSnapshot, originalInitialSnapshot); useConfigurator.getState().loadProject(original) })

describe('classic desktop workspace', () => {
  it('keeps classic CSS colors behind measured palette tokens', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    const rules = css.split('\n').filter((line) => line.trim().startsWith('.p100-'))
    expect(rules.join('\n')).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
  it('defaults to the classic shell with view tabs and a labelled H × W × D status', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const id = useConfigurator.getState().activeId
    useConfigurator.getState().setSelected(id)
    Object.assign(initialSnapshot, useConfigurator.getState())
    const html = renderToString(createElement(Workspace))
    expect(html).toContain('data-workspace-style="classic"')
    expect(html).toContain('data-testid="classic-toolbar"')
    expect(html).toContain('data-testid="classic-tool-save"')
    // The lesson target must survive toolbar command deduplication.
    expect(html.match(/data-testid="classic-tool-quote"/g)).toHaveLength(1)
    expect(html).toContain('data-testid="classic-tool-structure"')
    expect(html).toContain('data-testid="classic-tool-walk"')
    expect(html).toContain('data-testid="classic-tool-open-all"')
    expect(html).toContain('data-testid="classic-tool-ghost"')
    expect(html).toContain('data-testid="classic-tool-find"')
    expect(html).toContain('data-testid="classic-tool-replace"')
    expect(html).toContain('data-testid="classic-project-title"')
    expect(html).toContain('data-testid="classic-ar"')
    expect(html).toContain('data-testid="classic-vr"')
    expect(html).not.toContain('data-testid="classic-structure-window"')
    expect(html).toContain('lg:hidden"><section data-testid="tree-dock"')
    expect(html).toContain('data-tour="viewtabs"')
    expect(html).not.toContain('p100-camera-pane')
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
