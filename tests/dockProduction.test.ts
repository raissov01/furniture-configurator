import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { PricePanel } from '../components/panels/PricePanel'
import { InfoPanel } from '../components/panels/InfoPanel'
import { FindPanel } from '../components/panels/FindPanel'
import { PVC2, referenceProject } from './fixtures'

// Read the loaded fixture during SSR; all store actions and domain code are real.
vi.mock('../store/configurator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/configurator')>()
  type State = ReturnType<typeof actual.useConfigurator.getState>
  const hook = <T>(selector: (state: State) => T): T => selector(actual.useConfigurator.getState())
  return { ...actual, useConfigurator: Object.assign(hook, actual.useConfigurator) }
})

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))
function loadBoard(hidden = false, invalid = false) {
  const project = parseProjectV4(referenceProject)
  project.root.children = [{ kind: 'board', id: 'board', name: 'Еркін тақта',
    transform: IDENTITY_TRANSFORM, layerId: 'boards', board: {
      materialId: project.materials[0]!.id, length: invalid ? 1 : 600, width: 400,
      orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: true,
      edges: { L1: { bandId: PVC2 }, L2: null, W1: null, W2: null },
    } }]
  // A 1 mm length with 2 mm at its end cannot be sawn.
  if (invalid && project.root.children[0]?.kind === 'board') {
    project.root.children[0].board.edges.W1 = { bandId: PVC2 }
  }
  project.layers = [{ id: 'boards', name: 'Тақталар', visible: !hidden, locked: false, color: '#000000' }]
  useConfigurator.getState().loadProject(project)
  useConfigurator.getState().setSelected('board')
}
const render = (component: typeof PricePanel | typeof InfoPanel | typeof FindPanel) =>
  renderToStaticMarkup(createElement(component))

describe('dock panels use the canonical manufacturing tree', () => {
  it('includes free boards in the quote and selected part information', () => {
    loadBoard()
    expect(render(PricePanel)).toContain('Листов всего')
    const info = render(InfoPanel)
    expect(info).toContain('Еркін тақта')
    expect(info).toContain('600 × 400')
    expect(info).toContain('600 × 398')
  })

  it('removes hidden layer boards from quote and selection information', () => {
    loadBoard(true)
    expect(render(PricePanel)).toContain('Нет деталей для раскроя.')
    expect(render(InfoPanel)).not.toContain('Еркін тақта')
  })

  it.each([PricePanel, InfoPanel, FindPanel])('shows an invalid board error in %s instead of stale data', (component) => {
    loadBoard(false, true)
    const html = render(component)
    expect(html).toContain('role="alert"')
    expect(html).toContain('cutLength')
  })

  it.each([PricePanel, InfoPanel, FindPanel])('shows damaged saved project error in %s', (component) => {
    loadBoard()
    useConfigurator.setState({ projectLoadError: 'Сақталған жоба оқылмады' })
    const html = render(component)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Сақталған жоба оқылмады')
    expect(html).not.toContain('600 × 398')
  })
})
