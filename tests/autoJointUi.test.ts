import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, ORIENT_SIDE, parseProjectV4 } from '../src/core/index'
import type { BoardNode, ProjectFileV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { useProjectProduction } from '../lib/useProjectProduction'
import { StructurePanel } from '../components/panels/StructurePanel'
import { CutPage } from '../components/CutPage'
import { referenceProject } from './fixtures'

vi.mock('../store/configurator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/configurator')>()
  type State = ReturnType<typeof actual.useConfigurator.getState>
  const hook = <T>(selector: (state: State) => T): T => selector(actual.useConfigurator.getState())
  return { ...actual, useConfigurator: Object.assign(hook, actual.useConfigurator) }
})

const baseline = useConfigurator.getState()
const state = () => useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

function fixture(): ProjectFileV4 {
  const project = parseProjectV4(referenceProject)
  const material = project.materials.find((entry) => entry.thickness === 16)!
  const board = (id: string, y: number, orientation: BoardNode['board']['orientation']): BoardNode => ({
    kind: 'board', id, name: id, transform: { ...IDENTITY_TRANSFORM, pos: { x: 0, y, z: 0 } },
    board: { materialId: material.id, length: 500, width: 300, orientation,
      grainAlongLength: true, role: 'custom', edges: { L1: null, L2: null, W1: null, W2: null } },
  })
  project.root.children = [board('base', 0, ORIENT_HORIZONTAL), board('upright', 16, ORIENT_SIDE)]
  return project
}

function HoleCount() {
  const production = useProjectProduction()
  return createElement('output', { 'data-testid': 'production-hole-count',
    'data-error': production.error ?? '' }, String(production.panels.flatMap((panel) => panel.drilling).length))
}

describe('автоматты буынның UI өндіріс көрінісі', () => {
  it('v4 буынының тесіктері орталық өндіріс селекторына өтеді', () => {
    state().loadProject(fixture())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    expect(renderToStaticMarkup(createElement(HoleCount))).toContain('>4</output>')
  })

  it('тақталар ажырағанда Structure өріс атымен broken ескертуін көрсетеді', () => {
    state().loadProject(fixture())
    state().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    state().setBoardPosition('upright', { x: 0, y: 40, z: 0 })
    const html = renderToStaticMarkup(createElement(StructurePanel))
    expect(html).toContain('data-testid="broken-auto-joint"')
    expect(html).toContain('joint.boardIds')
    const production = renderToStaticMarkup(createElement(HoleCount))
    expect(production).toContain('>0</output>')
    expect(production).toContain('data-error="joint.boardIds')
    const cut = renderToStaticMarkup(createElement(CutPage))
    expect(cut).toContain('data-cut-panel-count="0"')
    expect(cut).toContain('joint.boardIds')
  })
})
