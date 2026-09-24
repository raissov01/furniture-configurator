/**
 * Топтау — тек құрылымдық әрекет: ештеңе көрінбей не құлыпталып қалмауы
 * керек. Жаңа топтың `layerId`-і жоқ болса, ол әдепкі қабатқа түседі де,
 * әдепкі қабат жасырын/құлыпты болғанда басқа қабаттағы түйіндерді жасырып/
 * құлыптап тастайды (сметадан жоғалады, қайта таратуға да болмайды).
 */
import { describe, expect, it } from 'vitest'
import { createDefaultLayer, flattenTree, IDENTITY_TRANSFORM } from '../src/core/index'
import { assertTreeNodeEditable, groupNodes, ungroupNode } from '../src/core/treeEditing'
import type { GroupNode, Layer, SceneNode } from '../src/core/index'
import { catalog } from './fixtures'

const tech: Layer = { id: 'tech', name: 'Техника', visible: true, locked: false, color: '#000000' }
const other: Layer = { id: 'other', name: 'Басқа', visible: true, locked: false, color: '#111111' }
const solid = (id: string, layerId?: string): SceneNode => ({ kind: 'solid', id, name: id, transform: IDENTITY_TRANSFORM,
  solid: { size: { x: 10, y: 10, z: 10 } }, ...(layerId ? { layerId } : {}) })
const root = (...children: SceneNode[]): GroupNode => ({ kind: 'group', id: 'root', name: 'P', transform: IDENTITY_TRANSFORM, children })
const solids = (tree: GroupNode, layers: Layer[]) => flattenTree(tree, catalog, undefined, layers).solids.map((s) => s.nodeId)

describe('топтау қабат күйін өзгертпейді', () => {
  it('әдепкі қабат жасырын: бір қабаттағы түйіндер топталғанда көрінбей қалмайды', () => {
    const layers = [{ ...createDefaultLayer(), visible: false }, tech]
    const tree = root(solid('a', 'tech'), solid('b', 'tech'))
    const grouped = groupNodes(tree, ['a', 'b'], 'g', 'G', layers)
    expect(solids(grouped, layers)).toEqual(solids(tree, layers))
    expect(ungroupNode(grouped, 'g', layers)).toEqual(tree)
  })

  it('әдепкі қабат құлыпты: топталған түйін өңделетін күйде қалады', () => {
    const layers = [{ ...createDefaultLayer(), locked: true }, tech]
    const grouped = groupNodes(root(solid('a', 'tech'), solid('b', 'tech')), ['a', 'b'], 'g', 'G', layers)
    expect(() => assertTreeNodeEditable(grouped, 'a', layers)).not.toThrow()
    expect(() => ungroupNode(grouped, 'g', layers)).not.toThrow()
  })

  it('әр қабаттағы түйіндерді жасырын/құлыпты әдепкі қабаттағы топқа салмайды', () => {
    const hidden = [{ ...createDefaultLayer(), visible: false }, tech, other]
    const tree = root(solid('a', 'tech'), solid('b', 'other'))
    expect(() => groupNodes(tree, ['a', 'b'], 'g', 'G', hidden)).toThrow(/қабат/)
    // Әдепкі қабат ашық әрі құлыпсыз болса — топ сонда, бәрі бұрынғыдай.
    const open = [createDefaultLayer(), tech, other]
    const grouped = groupNodes(tree, ['a', 'b'], 'g', 'G', open)
    expect(solids(grouped, open)).toEqual(['a', 'b'])
  })
})
