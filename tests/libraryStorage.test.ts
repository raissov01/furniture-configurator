import { describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile } from '../src/core/index'
import { createLibraryItem } from '../src/core/library'
import { exportLibraryJson, importLibraryJson, readLocalLibrary, writeLocalLibrary } from '../lib/libraryLocal'
import type { SceneNode } from '../src/core/tree'

const catalog = catalogOf(defaultShopProfile())
const node: SceneNode = { kind: 'solid', id: 'solid', name: 'Декор',
  transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, solid: { size: { x: 100, y: 200, z: 300 } } }
const item = createLibraryItem(node, catalog, 'Декор', '2026-09-25T00:00:00.000Z', 'entry')
const storage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

describe('жергілікті кітапхана және JSON', () => {
  it('сақтау және экспорт/импорт бір schemaVersion 1 файлымен жүреді', () => {
    const local = storage()
    writeLocalLibrary(local, [item])
    expect(readLocalLibrary(local)).toEqual([item])
    const json = exportLibraryJson([item])
    expect(importLibraryJson(json, [])).toEqual([item])
    expect(importLibraryJson(json, [item])).toEqual([item])
  })

  it('бүлінген JSON, қайталанған ID және өзгерген ID нұсқасы ашық қате береді', () => {
    expect(() => importLibraryJson('{', [])).toThrow()
    expect(() => importLibraryJson(JSON.stringify({ schemaVersion: 1, items: [item, item] }), [])).toThrow(/id/i)
    expect(() => importLibraryJson(exportLibraryJson([item]), [{ ...item, name: 'Басқа' }])).toThrow(/id/i)
  })

  it('импорттағы материал сілтемесі толық болмаса файл қабылданбайды', () => {
    const board = { ...item, node: { kind: 'board', id: 'board', name: 'Тақта',
      transform: node.transform, board: { materialId: 'missing-material', length: 600, width: 400,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } } }
    expect(() => importLibraryJson(JSON.stringify({ schemaVersion: 1, items: [board] }), [])).toThrow(/material/i)
  })
})
