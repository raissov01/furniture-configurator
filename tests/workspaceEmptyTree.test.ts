import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Workspace } from '../components/Workspace'
import { RoomPlan } from '../components/RoomPlan'
import { IDENTITY_TRANSFORM, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const original = useConfigurator.getState().exportProject()
const initialSnapshot = useConfigurator.getInitialState()
const originalInitialSnapshot = { ...initialSnapshot }

afterEach(() => {
  Object.assign(initialSnapshot, originalInitialSnapshot)
  useConfigurator.getState().loadProject(original)
  useConfigurator.getState().setRoomOpen(false)
})

describe('cabinet-free v4 editor shell', () => {
  it.each(['empty', 'board'] as const)('renders Workspace and RoomPlan for a %s-only root', (kind) => {
    const project = parseProjectV4(referenceProject)
    project.root.children = kind === 'empty' ? [] : [{
      kind: 'board', id: 'free-board', name: 'Free-board-target', transform: IDENTITY_TRANSFORM,
      board: { materialId: referenceProject.cabinets[0]!.carcassMaterialId,
        length: 500, width: 300, role: 'custom', grainAlongLength: false,
        orientation: { length: 'x', width: 'y', thickness: 'z' },
        edges: { L1: null, L2: null, W1: null, W2: null } },
    }]
    useConfigurator.getState().loadProject(project)
    expect(useConfigurator.getState().cabinets).toEqual([])
    Object.assign(initialSnapshot, useConfigurator.getState())
    const editor = renderToString(createElement(Workspace))
    expect(editor).toContain('Выберите корпус в структуре проекта')
    expect(editor).not.toContain('2000 (H)')
    expect(editor.includes('Free-board-target')).toBe(kind === 'board')
    useConfigurator.getState().setRoomOpen(true)
    Object.assign(initialSnapshot, useConfigurator.getState())
    expect(() => renderToString(createElement(RoomPlan))).not.toThrow()
  })

  it('does not expose a different cabinet editor while a board is active', () => {
    const project = parseProjectV4(referenceProject)
    project.root.children.push({
      kind: 'board', id: 'selected-board', name: 'Selected board', transform: IDENTITY_TRANSFORM,
      board: { materialId: referenceProject.cabinets[0]!.carcassMaterialId,
        length: 500, width: 300, role: 'custom', grainAlongLength: false,
        orientation: { length: 'x', width: 'y', thickness: 'z' },
        edges: { L1: null, L2: null, W1: null, W2: null } },
    })
    useConfigurator.getState().loadProject(project)
    useConfigurator.getState().setActive('selected-board')
    Object.assign(initialSnapshot, useConfigurator.getState())
    const editor = renderToString(createElement(Workspace))
    expect(editor).toContain('Выберите корпус в структуре проекта')
    expect(editor).not.toContain('2000 (H)')
  })
})
