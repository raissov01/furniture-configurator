import { describe, expect, it } from 'vitest'
import { createDefaultLayer, DEFAULT_ROOM, IDENTITY_TRANSFORM, parseProjectV4, placementPose } from '../src/core/index'
import { cabinetsFromTree, reconcileCabinetsInTree } from '../store/treeAdapters'
import type { GroupNode, Placement } from '../src/core/index'
import { referenceProject } from './fixtures'

describe('canonical tree compatibility adapters', () => {
  it('roundtrips migrated cabinets and wall placements without adding parallel fields', () => {
    const project = parseProjectV4(referenceProject)
    const view = cabinetsFromTree(project.root, project.room)
    expect(view.cabinets).toEqual(referenceProject.cabinets)
    for (const placement of referenceProject.placements) {
      const read = view.placements.find((item) => item.cabinetId === placement.cabinetId)!
      expect(placementPose(project.room, view.cabinets.find((c) => c.id === placement.cabinetId)!, read))
        .toEqual(placementPose(project.room, view.cabinets.find((c) => c.id === placement.cabinetId)!, placement))
    }
    expect('cabinets' in project).toBe(false)
  })

  it('preserves nested groups and free boards when a legacy cabinet editor changes dimensions', () => {
    const cabinet = referenceProject.cabinets[0]!
    const root: GroupNode = { kind: 'group', id: 'root', name: 'Project', transform: IDENTITY_TRANSFORM, children: [
      { kind: 'group', id: 'group', name: 'Group', transform: IDENTITY_TRANSFORM, children: [
        { kind: 'cabinet', id: cabinet.id, name: cabinet.name, transform: IDENTITY_TRANSFORM, config: cabinet },
      ] },
      { kind: 'solid', id: 'decor', name: 'Decor', transform: IDENTITY_TRANSFORM, solid: { size: { x: 10, y: 10, z: 10 } } },
    ] }
    const updated = { ...cabinet, width: cabinet.width + 1 }
    const placement: Placement = { cabinetId: cabinet.id, wall: 'south', offset: 0 }
    const result = reconcileCabinetsInTree(root, DEFAULT_ROOM, [updated], [placement])
    expect((result.children[0] as GroupNode).children[0]).toMatchObject({ kind: 'cabinet', config: { width: updated.width } })
    expect(result.children[1]).toEqual(root.children[1])
  })

  it('does not snap freely placed cabinets to walls during an unrelated config edit', () => {
    const cabinet = referenceProject.cabinets[0]!
    const root: GroupNode = { kind: 'group', id: 'root', name: 'Project', transform: IDENTITY_TRANSFORM,
      children: [{ kind: 'group', id: 'nested', name: 'Nested', transform: position(300, 700), children: [
        { kind: 'cabinet', id: cabinet.id, name: cabinet.name, config: cabinet,
          transform: position(13, 19) },
      ] }] }
    const view = cabinetsFromTree(root, DEFAULT_ROOM)
    const changed = reconcileCabinetsInTree(root, DEFAULT_ROOM,
      [{ ...view.cabinets[0]!, width: cabinet.width + 1 }], view.placements)
    expect((changed.children[0] as GroupNode).children[0]!.transform).toEqual(position(13, 19))
  })

  it('uses node identity for a valid v4 cabinet with a different nested config id', () => {
    const cabinet = referenceProject.cabinets[0]!
    const root: GroupNode = { kind: 'group', id: 'root', name: 'Project', transform: IDENTITY_TRANSFORM,
      children: [{ kind: 'cabinet', id: 'node-id', name: cabinet.name,
        transform: IDENTITY_TRANSFORM, config: { ...cabinet, id: 'legacy-config-id' } }] }
    const view = cabinetsFromTree(root, DEFAULT_ROOM)
    expect(view.cabinets[0]?.id).toBe('node-id')
    expect(reconcileCabinetsInTree(root, DEFAULT_ROOM, view.cabinets, view.placements).children)
      .toMatchObject([{ id: 'node-id', config: { id: 'node-id' } }])
  })

  it('omits scene placement when an ancestor layer is hidden', () => {
    const cabinet = referenceProject.cabinets[0]!
    const root: GroupNode = { kind: 'group', id: 'root', name: 'Project', transform: IDENTITY_TRANSFORM,
      children: [{ kind: 'group', id: 'technical', name: 'Technical', layerId: 'off',
        transform: IDENTITY_TRANSFORM, children: [
          { kind: 'cabinet', id: cabinet.id, name: cabinet.name, config: cabinet,
            transform: IDENTITY_TRANSFORM },
        ] }] }
    const view = cabinetsFromTree(root, DEFAULT_ROOM, [createDefaultLayer(),
      { id: 'off', name: 'Off', visible: false, locked: false, color: '#000000' }])
    expect(view.cabinets).toHaveLength(1)
    expect(view.placements).toHaveLength(0)
  })
})

function position(x: number, z: number) {
  return { pos: { x, y: 0, z }, rot: { x: 0, y: 0, z: 0 } }
}
