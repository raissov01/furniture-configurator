import { describe, expect, it } from 'vitest'
import { catalogOf, createDefaultLayer, flattenTree, IDENTITY_TRANSFORM, parseProjectV4 } from '../src/core/index'
import { poseFootprint, treeSceneBounds, treeSceneItems, treeSceneLayoutKey, visibleBoardPanels, wallBoundItems } from '../lib/treeSceneItems'
import { flattenForPreview } from '../lib/useTreeSceneItems'
import { defaultShop } from '../lib/defaults'
import { referenceProject } from './fixtures'

describe('v4 3D scene adapter', () => {
  it('uses canonical world pose for a free-position cabinet and disables wall drag', () => {
    const project = parseProjectV4(referenceProject)
    const cabinet = project.root.children[0]!
    cabinet.transform = { pos: { x: 1500, y: 0, z: 1200 }, rot: { x: 0, y: 0, z: 0 } }
    const scene = flattenTree(project.root, catalogOf(defaultShop), project.settings, project.layers)
    const result = treeSceneItems(project.root, project.room, scene, project.layers ?? [createDefaultLayer()])
    expect(result.items[0]?.pose).toEqual(scene.nodes[0]?.pose)
    expect(result.items[0]?.wallBound).toBe(false)
    expect(wallBoundItems(result.items)).toEqual([])
  })

  it('exposes free boards and solids without inventing cabinets', () => {
    const project = parseProjectV4(referenceProject)
    project.root.children = [
      { kind: 'board', id: 'board', name: 'Board', transform: IDENTITY_TRANSFORM,
        board: { materialId: referenceProject.cabinets[0]!.carcassMaterialId,
          length: 500, width: 300, role: 'custom', grainAlongLength: false,
          orientation: { length: 'x', width: 'y', thickness: 'z' },
          edges: { L1: null, L2: null, W1: null, W2: null } } },
      { kind: 'solid', id: 'decor', name: 'Decor', transform: IDENTITY_TRANSFORM,
        solid: { size: { x: 50, y: 60, z: 70 } } },
    ]
    const scene = flattenTree(project.root, catalogOf(defaultShop), project.settings, project.layers)
    const result = treeSceneItems(project.root, project.room, scene, project.layers ?? [createDefaultLayer()])
    expect(result.items).toHaveLength(0)
    expect(result.boards.map((node) => node.nodeId)).toEqual(['board'])
    expect(result.solids.map((node) => node.nodeId)).toEqual(['decor'])
    expect(treeSceneBounds(result, catalogOf(defaultShop))).toEqual({
      x0: 0, x1: 500, y0: 0, y1: 300, z0: 0, z1: 70,
    })
    expect(visibleBoardPanels(result.boards[0]!, new Map([['board', 2]]), 1, 1)).toEqual([])
    expect(visibleBoardPanels(result.boards[0]!, new Map([['board', 2]]), 2, 1)).toHaveLength(1)
    const firstLayout = treeSceneLayoutKey(project.room, '', result, catalogOf(defaultShop))
    const board = project.root.children[0]!
    if (board.kind !== 'board') throw new Error('test fixture must be a board')
    board.board.length = 2000
    const longer = treeSceneItems(project.root, project.room,
      flattenTree(project.root, catalogOf(defaultShop), project.settings, project.layers), project.layers ?? [])
    expect(treeSceneLayoutKey(project.room, '', longer, catalogOf(defaultShop))).not.toBe(firstLayout)
  })

  it('frames an arbitrary cabinet from its actual pose', () => {
    const project = parseProjectV4(referenceProject)
    const cabinet = project.root.children[0]!
    cabinet.transform = { pos: { x: 1500, y: 0, z: 1200 }, rot: { x: 0, y: 90, z: 0 } }
    const scene = flattenTree(project.root, catalogOf(defaultShop))
    const item = treeSceneItems(project.root, project.room, scene, [createDefaultLayer()]).items[0]!
    expect(poseFootprint(item)).toEqual({ x: 1500, z: 600, width: 450, depth: 600 })
  })

  it('marks a cabinet beneath a locked parent as non-editable for scene drag', () => {
    const project = parseProjectV4(referenceProject)
    const cabinet = project.root.children[0]!
    project.root.children = [{ kind: 'group', id: 'locked-group', name: 'Locked', locked: true,
      transform: IDENTITY_TRANSFORM, children: [cabinet] }]
    const scene = flattenTree(project.root, catalogOf(defaultShop), project.settings, project.layers)
    const result = treeSceneItems(project.root, project.room, scene, project.layers ?? [createDefaultLayer()])
    expect(result.items[0]?.editable).toBe(false)
  })

  it('surfaces invalid board generation while retaining only the visual preview', () => {
    const project = parseProjectV4(referenceProject)
    const catalog = catalogOf(defaultShop)
    const valid = flattenTree(project.root, catalog)
    project.root.children = [{ kind: 'board', id: 'bad', name: 'Missing material',
      transform: IDENTITY_TRANSFORM,
      board: { materialId: 'no-such-material', length: 500, width: 300, role: 'custom',
        grainAlongLength: false, orientation: { length: 'x', width: 'y', thickness: 'z' },
        edges: { L1: null, L2: null, W1: null, W2: null } } }]
    const result = flattenForPreview(project.root, catalog, undefined, project.layers ?? [], valid)
    expect(result.scene).toBe(valid)
    expect(result.error?.field).toBe('board[bad].materialId')
  })
})
