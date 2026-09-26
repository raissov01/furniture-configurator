import { describe, expect, it } from 'vitest'
import { PROP_CATALOG, makePropLibraryItem, removePropNode } from '../src/core/propCatalog'
import { flattenTree, scenePanels } from '../src/core/flatten'
import { SEED_CATALOG } from '../src/core/seed'
import { insertLibraryItem, parseLibraryItem } from '../src/core/library'
import type { GroupNode } from '../src/core/tree'

const position = { x: 120, y: 300, z: 40 }

describe('owned primitive decor props', () => {
  it('offers several categories and only integer box primitives', () => {
    expect(new Set(PROP_CATALOG.map((p) => p.category)).size).toBeGreaterThanOrEqual(3)
    for (const prop of PROP_CATALOG) for (const part of prop.parts) {
      expect(Object.values({ ...part.size, ...part.position }).every(Number.isInteger)).toBe(true)
    }
  })

  it('serializes as solids and never enters manufacturing panels', () => {
    const item = makePropLibraryItem(PROP_CATALOG[0]!, position, '2026-09-26T00:00:00.000Z')
    parseLibraryItem(item)
    const emptyRoot: GroupNode = { kind: 'group', id: 'root', name: 'Project', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [] }
    let nextId = 0
    const root = insertLibraryItem(emptyRoot, item, SEED_CATALOG, 'root', () => `placed-${++nextId}`)
    const scene = flattenTree(root, SEED_CATALOG)
    expect(scene.solids.length).toBeGreaterThan(0)
    expect(scenePanels(scene)).toEqual([])
    expect(JSON.parse(JSON.stringify(root)).children[0].transform.pos).toEqual(position)
    expect(removePropNode(root, root.children[0]!.id).children).toEqual([])
  })
})
