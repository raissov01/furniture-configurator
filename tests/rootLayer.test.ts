/**
 * Түбір (root) — жобаның контейнері, ҚАБАТҚА ЖАТПАЙДЫ. Оның `layerId`-і жоқ,
 * сондықтан `resolveLayer` оны әдепкі қабатқа түсіреді. Егер түбір қабат
 * ережесіне бағынса, «Әдепкі қабатты» жасыру/құлыптау БАРЛЫҚ қабатты
 * жасырады/құлыптайды: «Техника» қабаты көрінетін болса да, смета мен
 * деталировкадан жоғалады.
 */
import { describe, expect, it } from 'vitest'
import { createDefaultLayer, DEFAULT_ROOM, flattenTree, IDENTITY_TRANSFORM, parseProjectV4, productionCabinets } from '../src/core/index'
import { assertTreeNodeEditable, reparentNode } from '../src/core/treeEditing'
import { buildCanonicalRows } from '../components/panels/canonicalTreeRows'
import { cabinetsFromTree } from '../store/treeAdapters'
import type { GroupNode, Layer } from '../src/core/index'
import { catalog, referenceProject } from './fixtures'

const cabinet = referenceProject.cabinets[0]!
const tech: Layer = { id: 'tech', name: 'Техника', visible: true, locked: false, color: '#000000' }
const root = (): GroupNode => ({ kind: 'group', id: 'root', name: 'P', transform: IDENTITY_TRANSFORM, children: [
  { kind: 'cabinet', id: cabinet.id, name: cabinet.name, layerId: 'tech', transform: { pos: { x: 0, y: 0, z: 2550 }, rot: { x: 0, y: 0, z: 0 } }, config: cabinet },
  { kind: 'solid', id: 'plain', name: 'Plain', transform: IDENTITY_TRANSFORM, solid: { size: { x: 10, y: 10, z: 10 } } },
  { kind: 'group', id: 'box', name: 'Box', layerId: 'tech', transform: IDENTITY_TRANSFORM, children: [] },
] })

describe('түбір қабатқа бағынбайды', () => {
  it('әдепкі қабат жасырылса, тек соның түйіндері жоғалады', () => {
    const layers = [{ ...createDefaultLayer(), visible: false }, tech]
    const scene = flattenTree(root(), catalog, undefined, layers)
    expect(scene.nodes.map((node) => node.nodeId)).toEqual([cabinet.id])
    expect(scene.solids).toEqual([])
    expect(cabinetsFromTree(root(), DEFAULT_ROOM, layers).placements.map((p) => p.cabinetId)).toEqual([cabinet.id])
    const file = { ...parseProjectV4(referenceProject), root: root(), layers }
    expect(productionCabinets(file).map((item) => item.id)).toEqual([cabinet.id])
    const rows = buildCanonicalRows(root(), scene, layers)
    expect(rows.find((row) => row.id === cabinet.id)).toMatchObject({ hidden: false })
    expect(rows.find((row) => row.id === 'plain')).toMatchObject({ hidden: true })
  })

  it('әдепкі қабат құлыпталса, басқа қабаттың түйіні өңделеді', () => {
    const layers = [{ ...createDefaultLayer(), locked: true }, tech]
    expect(() => assertTreeNodeEditable(root(), cabinet.id, layers)).not.toThrow()
    expect(() => assertTreeNodeEditable(root(), 'plain', layers)).toThrow(/құлып/)
    expect(() => reparentNode(root(), cabinet.id, 'box', layers)).not.toThrow()
    const rows = buildCanonicalRows(root(), flattenTree(root(), catalog, undefined, layers), layers)
    expect(rows.find((row) => row.id === cabinet.id)).toMatchObject({ locked: false })
  })

  it('түбірдің өз hidden/locked белгісі бұрынғыша бәрін қамтиды', () => {
    const hidden = { ...root(), hidden: true }
    expect(flattenTree(hidden, catalog, undefined, [createDefaultLayer(), tech]).nodes).toEqual([])
    const locked = { ...root(), locked: true }
    expect(() => assertTreeNodeEditable(locked, cabinet.id, [createDefaultLayer(), tech])).toThrow(/құлып/)
  })
})
