import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '../src/core/tree'
import type { CabinetConfig, FlatScene, GroupNode, Layer, SceneNode } from '../src/core/index'
import { buildCanonicalRows, selectTreeRows, canDropInto, externalSelectionNodeIds } from '../components/panels/canonicalTreeRows'

const group = (id: string, children: SceneNode[]): GroupNode => ({
  kind: 'group', id, name: id, transform: IDENTITY_TRANSFORM, children,
})
const solid = (id: string): SceneNode => ({
  kind: 'solid', id, name: id, transform: IDENTITY_TRANSFORM,
  solid: { size: { x: 100, y: 100, z: 100 } },
})
const cabinet = (id: string): SceneNode => ({
  kind: 'cabinet', id, name: id, transform: IDENTITY_TRANSFORM,
  config: { id } as CabinetConfig,
})
const layers: Layer[] = [
  { id: 'default', name: 'Default', visible: true, locked: false, color: '#aaaaaa' },
  { id: 'hidden', name: 'Hidden', visible: false, locked: false, color: '#333333' },
  { id: 'locked', name: 'Locked', visible: true, locked: true, color: '#777777' },
]
const scene = (...ids: string[]): FlatScene => ({
  nodes: ids.map((nodeId) => ({
    nodeId, name: nodeId, pose: { position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    hardware: [], panels: [{ id: 'side', label: 'Side', role: 'side' }] as FlatScene['nodes'][number]['panels'],
  })),
  solids: [],
})

describe('canonical tree rows', () => {
  it('retains recursive project order, types and generated part descendants', () => {
    const root = group('root', [group('g', [cabinet('c'), solid('s')])])
    const rows = buildCanonicalRows(root, scene('c'), layers)
    expect(rows.map((r) => [r.id, r.depth, r.kind])).toEqual([
      ['root', 0, 'group'], ['g', 1, 'group'], ['c', 2, 'cabinet'],
      ['part:c:side', 3, 'part'], ['s', 2, 'solid'],
    ])
    expect(rows[3]!.selectId).toBe('side')
  })

  it('uses projectPanelId prefix when the scene has multiple production nodes', () => {
    const root = group('root', [cabinet('c'), cabinet('d')])
    const rows = buildCanonicalRows(root, scene('c', 'd'), layers)
    expect(rows.find((r) => r.id === 'part:c:side')!.selectId).toBe('c--side')
    expect(rows.find((r) => r.id === 'part:d:side')!.selectId).toBe('d--side')
  })

  it('maps a free board node click to the same panel key as its generated part row', () => {
    const board = { kind: 'board', id: 'b', name: 'Board', transform: IDENTITY_TRANSFORM, board: {} } as SceneNode
    const root = group('root', [board, cabinet('c'), solid('s')])
    const rows = buildCanonicalRows(root, scene('b', 'c'), layers)
    expect(rows.find((r) => r.id === 'b')!.selectId).toBe('b--side')
    expect(rows.find((r) => r.id === 'b')!.selectId).toBe(rows.find((r) => r.id === 'part:b:side')!.selectId)
    expect(rows.find((r) => r.id === 's')!.selectId).toBe('s')
  })

  it('keeps hidden nodes visible in tree but suppresses production children, inheriting flags', () => {
    const root = group('root', [
      { ...group('g', [cabinet('c')]), layerId: 'hidden' },
      { ...solid('s'), layerId: 'locked' },
    ])
    const rows = buildCanonicalRows(root, scene('c'), layers)
    expect(rows.map((r) => r.id)).toEqual(['root', 'g', 'c', 's'])
    expect(rows.find((r) => r.id === 'c')).toMatchObject({ hidden: true, parentId: 'g' })
    expect(rows.find((r) => r.id === 's')).toMatchObject({ locked: true })
  })

  it('single, ctrl-toggle and shift-range select selectable node rows only', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect(selectTreeRows([], 'b', ids)).toEqual(['b'])
    expect(selectTreeRows(['b'], 'd', ids, { ctrl: true })).toEqual(['b', 'd'])
    expect(selectTreeRows(['b', 'd'], 'b', ids, { ctrl: true })).toEqual(['d'])
    expect(selectTreeRows(['b'], 'd', ids, { shift: true, anchor: 'b' })).toEqual(['b', 'c', 'd'])
  })

  it('only a changed 3D selection replaces a local multi-selection', () => {
    const rows = buildCanonicalRows(group('root', [cabinet('c'), cabinet('d')]), scene('c', 'd'), layers)
    expect(externalSelectionNodeIds('c--side', 'c--side', rows)).toBeUndefined()
    expect(externalSelectionNodeIds('c--side', 'd--side', rows)).toEqual(['d'])
    expect(externalSelectionNodeIds('d--side', null, rows)).toEqual([])
    const grouped = buildCanonicalRows(group('root', [group('g', [cabinet('c')])]), scene('c'), layers)
    expect(externalSelectionNodeIds('side', null, grouped, 'g')).toEqual(['g'])
  })

  it('drop allows group target, rejects self/descendant and non-group targets', () => {
    const root = group('root', [group('a', [group('child', [])]), group('b', []), solid('s')])
    expect(canDropInto(root, 'a', 'b')).toBe(true)
    expect(canDropInto(root, 'a', 'child')).toBe(false)
    expect(canDropInto(root, 'a', 'a')).toBe(false)
    expect(canDropInto(root, 'a', 's')).toBe(false)
    expect(canDropInto(root, 'root', 'b')).toBe(false)
  })
})
