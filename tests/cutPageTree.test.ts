import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { CutPage } from '../components/CutPage'
import { PVC2, referenceProject } from './fixtures'

// SSR normally reads Zustand's initial snapshot. Read the current fixture here;
// generation, validation and export button rendering remain real code.
vi.mock('../store/configurator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/configurator')>()
  type State = ReturnType<typeof actual.useConfigurator.getState>
  const hook = <T>(selector: (state: State) => T): T => selector(actual.useConfigurator.getState())
  return { ...actual, useConfigurator: Object.assign(hook, actual.useConfigurator) }
})

const baseline = useConfigurator.getState()
afterEach(() => { useConfigurator.setState(baseline, true); vi.unstubAllGlobals() })

function file(hidden = false, invalid = false) {
  const project = parseProjectV4(referenceProject)
  project.name = 'Тақтаның жеке раскройы'
  project.root.children = [{ kind: 'board', id: 'free-board', name: 'Тақта', hidden,
    transform: IDENTITY_TRANSFORM, board: {
      materialId: project.materials[0]!.id, length: invalid ? 1 : 600, width: 400,
      orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: true,
      edges: { L1: null, L2: null, W1: { bandId: PVC2 }, W2: { bandId: PVC2 } },
    } }]
  return project
}

function cncButton(html: string): string {
  return html.match(/<button[^>]*title="Присадка для станка:[^>]*>/)?.[0] ?? ''
}

describe('/cut reads canonical tree production', () => {
  it('keeps every export action reachable at a 390 px viewport', () => {
    const html = renderToStaticMarkup(createElement(CutPage))
    const toolbar = html.match(/<div[^>]*data-testid="cut-export-actions"[^>]*class="([^"]+)"/)
    expect(toolbar?.[1]).toContain('w-full')
    expect(toolbar?.[1]).toContain('flex-wrap')
    expect(html).toContain('aria-controls="cut-export-actions"')
    expect(html).toContain('>Базис</button>')

    const source = readFileSync(new URL('../components/CutPage.tsx', import.meta.url), 'utf8')
    const sheetSvgClass = source.match(/<svg[\s\S]*?className="([^"]+)"/)?.[1]
    expect(sheetSvgClass).toContain('w-full')
    expect(sheetSvgClass).toContain('min-w-[520px]')
    expect(sheetSvgClass).toContain('h-auto')
    expect(source).toContain('max-w-full overflow-x-auto')
  })

  it('does not offer a default cabinet export when the saved project cannot be read', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{broken json' } })
    useConfigurator.getState().hydrateProject()
    const html = renderToStaticMarkup(createElement(CutPage))
    expect(html).toContain('role="alert"')
    expect(html).toContain('data-cut-panel-count="0"')
    expect(cncButton(html)).toContain('disabled=""')
  })

  it('renders a board-only saved project and its project title', () => {
    useConfigurator.getState().loadProject(file())
    const html = renderToStaticMarkup(createElement(CutPage))
    expect(html).toContain('data-cut-panel-count="1"')
    expect(html).toContain('Тақтаның жеке раскройы')
    expect(cncButton(html)).not.toBe('')
    expect(cncButton(html)).not.toContain('disabled=""')
  })

  it('offers no CNC export for hidden or invalid tree panels, and reports invalid dimensions', () => {
    useConfigurator.getState().loadProject(file(true))
    const hidden = renderToStaticMarkup(createElement(CutPage))
    expect(hidden).toContain('data-cut-panel-count="0"')
    expect(cncButton(hidden)).toContain('disabled=""')
    const layer = file()
    layer.root.children[0]!.layerId = 'hidden-layer'
    layer.layers = [{ id: 'hidden-layer', name: 'Жасырын', visible: false, locked: false, color: '#000000' }]
    useConfigurator.getState().loadProject(layer)
    const hiddenLayer = renderToStaticMarkup(createElement(CutPage))
    expect(hiddenLayer).toContain('data-cut-panel-count="0"')
    expect(cncButton(hiddenLayer)).toContain('disabled=""')
    const invalidFile = file(false, true)
    useConfigurator.getState().loadProject(invalidFile)
    const invalid = renderToStaticMarkup(createElement(CutPage))
    expect(invalid).toContain('role="alert"')
    expect(cncButton(invalid)).toContain('disabled=""')
    expect(invalid).toContain('cutLength')
  })
})
