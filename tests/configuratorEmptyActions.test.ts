import { afterEach, describe, expect, it } from 'vitest'
import { flattenTree, IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, parseProjectV4 } from '../src/core/index'
import { defaultCabinet } from '../lib/defaults'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

const actions = [
  { name: 'addCabinet', run: () => useConfigurator.getState().addCabinet() },
  { name: 'loadTemplate', run: () => useConfigurator.getState().loadTemplate('wardrobe-penal-600') },
  { name: 'loadCabinet', run: () => useConfigurator.getState().loadCabinet({ ...defaultCabinet, name: 'AI корпус' }) },
]

describe.each(['empty', 'board selected'] as const)('new cabinet in a %s project', (mode) => {
  it.each(actions)('$name adds a valid cabinet without replacing existing nodes, with one undo', ({ run }) => {
    const file = parseProjectV4(referenceProject)
    if (mode === 'empty') file.root.children = []
    else file.root.children.push({ kind: 'board', id: 'board', name: 'Тақта', transform: IDENTITY_TRANSFORM,
      board: { materialId: file.materials[0]!.id, length: 600, width: 400,
        orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: false,
        edges: { L1: null, L2: null, W1: null, W2: null } } })
    useConfigurator.getState().loadProject(file)
    if (mode === 'board selected') useConfigurator.getState().setActive('board')
    const before = useConfigurator.getState().root
    const historyLength = useConfigurator.getState().past.length
    run()
    const state = useConfigurator.getState()
    const saved = state.exportProject()
    expect(() => parseProjectV4(saved)).not.toThrow()
    expect(() => flattenTree(saved.root, state.catalog, saved.settings, saved.layers)).not.toThrow()
    expect(saved.root.children).toHaveLength(before.children.length + 1)
    expect(saved.root.children.slice(0, before.children.length)).toEqual(before.children)
    expect(saved.root.children.at(-1)).toMatchObject({ kind: 'cabinet', id: state.activeId })
    expect(state.past).toHaveLength(historyLength + 1)
    state.undo()
    expect(useConfigurator.getState().root).toEqual(before)
    useConfigurator.getState().redo()
    expect(useConfigurator.getState().root).toEqual(saved.root)
  })
})
