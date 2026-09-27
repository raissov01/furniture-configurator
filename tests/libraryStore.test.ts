import { afterEach, describe, expect, it } from 'vitest'
import { flattenTree, scenePanels } from '../src/core/index'
import { createLibraryItem } from '../src/core/library'
import { useConfigurator } from '../store/configurator'
import type { SceneNode } from '../src/core/tree'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('кітапханадан жобаға қою', () => {
  it('құлыпталған топқа немесе қабатқа элемент қоймайды', () => {
    const state = useConfigurator.getState()
    const board: SceneNode = { kind: 'board', id: 'source-locked', name: 'Тақта',
      transform: state.root.transform,
      board: { materialId: state.catalog.materials[0]!.id, length: 500, width: 300,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }
    const item = createLibraryItem(board, state.catalog, 'Тақта', '2026-09-27T00:00:00.000Z', 'locked-item')
    const parent = { kind: 'group' as const, id: 'locked-parent', name: 'Құлыпты топ',
      transform: state.root.transform, children: [] }
    for (const [lockedGroup, lockedLayer] of [[true, false], [false, true]] as const) {
      const root = { ...state.root, children: [...state.root.children, { ...parent, locked: lockedGroup }] }
      useConfigurator.setState({ root, layers: state.layers.map((layer) =>
        layer.id === state.layers[0]!.id ? { ...layer, locked: lockedLayer } : layer) })
      expect(() => useConfigurator.getState().placeLibraryItem(item, parent.id)).toThrow(/құлып/)
      expect(useConfigurator.getState().root).toBe(root)
    }
    const rootLocked = { ...state.root, locked: true }
    useConfigurator.setState({ root: rootLocked, layers: state.layers })
    expect(() => useConfigurator.getState().placeLibraryItem(item)).toThrow(/құлып/)
    expect(useConfigurator.getState().root).toBe(rootLocked)
  })

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
  it('материалдың тек 3D PBR көрінісі өзгерсе, сақталған элементті қоюды бөгемейді', () => {
    const state = useConfigurator.getState()
    const materialId = state.catalog.materials[0]!.id
    const board: SceneNode = { kind: 'board', id: 'pbr-board', name: 'Тақта',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      board: { materialId, length: 500, width: 300,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }
    const item = createLibraryItem(board, state.catalog, 'Тақта', '2026-09-25T00:00:00.000Z', 'pbr-item')
    state.setMaterialPbr(materialId, { roughness: 0.3 })
    expect(() => useConfigurator.getState().placeLibraryItem(item)).not.toThrow()
    const next = useConfigurator.getState()
    expect(next.catalog.materials.find((entry) => entry.id === materialId)?.pbr).toEqual({ roughness: 0.3 })
  })
  it('кітапханадағы бөгде материалдың бағасы жобаға кірмейді: қою мен қайта ашу бір бағаны береді', () => {
    const state = useConfigurator.getState()
    const material = { ...state.catalog.materials[0]!, id: 'foreign-material', name: 'Бөгде', pricePerSheet: 999_00 }
    const board: SceneNode = { kind: 'board', id: 'foreign-board', name: 'Тақта',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      board: { materialId: material.id, length: 500, width: 300,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }
    const item = createLibraryItem(board, { ...state.catalog, materials: [...state.catalog.materials, material] },
      'Тақта', '2026-09-25T00:00:00.000Z', 'foreign-item')
    state.placeLibraryItem(item)
    const placed = useConfigurator.getState().catalog.materials.find((entry) => entry.id === material.id)
    useConfigurator.getState().loadProject(useConfigurator.getState().exportProject())
    const reopened = useConfigurator.getState().catalog.materials.find((entry) => entry.id === material.id)
    expect(placed?.pricePerSheet).toBe(reopened?.pricePerSheet)
  })
})
