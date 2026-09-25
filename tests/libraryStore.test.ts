import { afterEach, describe, expect, it } from 'vitest'
import { flattenTree, scenePanels } from '../src/core/index'
import { createLibraryItem } from '../src/core/library'
import { useConfigurator } from '../store/configurator'
import type { SceneNode } from '../src/core/tree'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('кітапханадан жобаға қою', () => {
  it('жаңа материалды жоба каталогына қосып, board-ты өндіріс панеліне жібереді', () => {
    const state = useConfigurator.getState()
    const material = { ...state.catalog.materials[0]!, id: 'my-library-material', name: 'Жеке материал' }
    const sourceCatalog = { ...state.catalog, materials: [...state.catalog.materials, material] }
    const board: SceneNode = { kind: 'board', id: 'source-board', name: 'Еркін тақта',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      board: { materialId: material.id, length: 600, width: 400,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }
    const item = createLibraryItem(board, sourceCatalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'library-board')
    const before = state.past.length
    state.placeLibraryItem(item)
    const next = useConfigurator.getState()
    expect(next.past).toHaveLength(before + 1)
    expect(next.catalog.materials.some((entry) => entry.id === material.id)).toBe(true)
    const panels = scenePanels(flattenTree(next.root, next.catalog, next.projectSettings ?? next.shop.settings, next.layers))
    expect(panels.some((panel) => panel.materialId === material.id && panel.finishedLength === 600)).toBe(true)
    expect(next.exportProject().materials.some((entry) => entry.id === material.id)).toBe(true)
    next.replaceFreeBoardMaterial(material.id, state.catalog.materials[0]!.id)
    const replaced = useConfigurator.getState()
    const replacedPanels = scenePanels(flattenTree(replaced.root, replaced.catalog,
      replaced.projectSettings ?? replaced.shop.settings, replaced.layers))
    expect(replacedPanels.some((panel) => panel.materialId === material.id)).toBe(false)
    expect(replacedPanels.some((panel) => panel.finishedLength === 600 && panel.materialId === state.catalog.materials[0]!.id)).toBe(true)
  })

  it('бүкіл жоба Замена cabinet пен board материалын бір undo қадамымен ауыстырады', () => {
    const state = useConfigurator.getState()
    const sourceId = state.cabinets[0]!.carcassMaterialId
    const targetId = state.catalog.materials.find((material) => material.id !== sourceId)!.id
    const board: SceneNode = { kind: 'board', id: 'source-board', name: 'Тақта',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      board: { materialId: sourceId, length: 500, width: 300,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }
    state.placeLibraryItem(createLibraryItem(board, state.catalog, 'Тақта', '2026-09-25T00:00:00.000Z', 'shared'))
    const before = useConfigurator.getState().past.length
    useConfigurator.getState().replaceProjectMaterial(sourceId, targetId)
    const changed = useConfigurator.getState()
    expect(changed.past).toHaveLength(before + 1)
    expect(changed.cabinets[0]!.carcassMaterialId).toBe(targetId)
    expect(changed.root.children.some((node) => node.kind === 'board' && node.board.materialId === targetId)).toBe(true)
    changed.undo()
    expect(useConfigurator.getState().cabinets[0]!.carcassMaterialId).toBe(sourceId)
  })
})
