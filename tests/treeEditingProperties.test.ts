/**
 * Ағаш операцияларының ИНВАРИАНТТАРЫ, кездейсоқ тізбекпен (property-style).
 *
 * Топтау / тарату / ата ауыстыру — тек құрылымдық әрекет: әр деталь мен
 * қораптың ӘЛЕМДЕГІ орны, деталировка мен id-лердің бірегейлігі өзгермеуі,
 * кіріс ағаш орнында өзгертілмеуі керек. Бұрылған (90/180/270°) топтар әдейі
 * қосылған: бұрынғы тесттер бұрылыссыз топпен ғана тексеретін.
 */
import { describe, expect, it } from 'vitest'
import { createDefaultLayer, flattenTree, scenePanels, walkTree } from '../src/core/index'
import { ConfigValidationError } from '../src/core/errors'
import { groupNodes, renameTreeNode, reparentNode, setTreeNodeFlag, ungroupNode } from '../src/core/treeEditing'
import type { GroupNode, SceneNode } from '../src/core/tree'
import { catalog, referenceProject } from './fixtures'

/** Детерминді кездейсоқ сан — құлаған тізбек қайталанатын болсын. */
function rng(seed: number): () => number {
  return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
}
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

function randomTree(r: () => number): GroupNode {
  let n = 0
  const transform = () => ({
    pos: { x: Math.floor(r() * 2000) - 1000, y: Math.floor(r() * 50), z: Math.floor(r() * 2000) - 1000 },
    rot: { x: 0, y: [0, 90, 180, 270, -90][Math.floor(r() * 5)]!, z: 0 },
  })
  const leaf = (): SceneNode => {
    const id = `n${n++}`
    const kind = r()
    if (kind < 0.15) return { kind: 'cabinet', id, name: id, transform: transform(), config: { ...referenceProject.cabinets[0]!, id } }
    if (kind < 0.55) return { kind: 'board', id, name: id, transform: transform(), board: {
      materialId: catalog.materials[0]!.id, length: 500 + n, width: 300,
      orientation: { length: 'x', width: 'z', thickness: 'y' }, edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: true, role: 'shelf' } }
    return { kind: 'solid', id, name: id, transform: transform(), solid: { size: { x: 10, y: 10, z: 10 } } }
  }
  const group = (depth: number): GroupNode => ({ kind: 'group', id: `n${n++}`, name: 'g', transform: transform(),
    children: Array.from({ length: 1 + Math.floor(r() * 4) }, () => depth < 2 && r() < 0.4 ? group(depth + 1) : leaf()) })
  return { ...group(0), id: 'root' }
}

function worldPoses(root: GroupNode): Map<string, string> {
  const result = new Map<string, string>()
  const round = (value: number) => Math.round(value * 1e6) / 1e6
  walkTree(root, (node, pose) => {
    if (node.kind !== 'group') result.set(node.id, JSON.stringify([round(pose.position.x), pose.position.y,
      round(pose.position.z), ((pose.rotationY % 360) + 360) % 360]))
  })
  return result
}
const nodeIds = (root: GroupNode) => { const ids: string[] = []; walkTree(root, (node) => ids.push(node.id)); return ids }
const groupIds = (root: GroupNode) => { const ids: string[] = []; walkTree(root, (node) => { if (node.kind === 'group') ids.push(node.id) }); return ids }
const production = (root: GroupNode) => {
  const scene = flattenTree(root, catalog, undefined, [createDefaultLayer()])
  return { panels: scenePanels(scene).map((p) => `${p.id}:${p.cutLength}x${p.cutWidth}`).sort(),
    solids: scene.solids.map((solid) => solid.nodeId).sort() }
}
const siblingsOf = (root: GroupNode, id: string) => {
  let siblings: string[] = []
  walkTree(root, (node) => { if (node.kind === 'group' && node.children.some((c) => c.id === id)) siblings = node.children.map((c) => c.id) })
  return siblings
}

describe('ағаш операцияларының инварианттары', () => {
  it('кездейсоқ тізбек: әлемдегі орын, деталировка, бірегей id, иммутабельдік', () => {
    const layers = [createDefaultLayer()]
    let applied = 0
    for (let seed = 1; seed <= 60; seed++) {
      const r = rng(seed)
      let root = freeze(randomTree(r))
      for (let step = 0; step < 25; step++) {
        const all = nodeIds(root).filter((id) => id !== 'root')
        const pick = () => all[Math.floor(r() * all.length)]!
        const groups = groupIds(root)
        const op = Math.floor(r() * 5)
        const before = JSON.stringify(root)
        let next: GroupNode
        try {
          if (op === 0) next = reparentNode(root, pick(), groups[Math.floor(r() * groups.length)]!, layers)
          else if (op === 1) next = groupNodes(root, siblingsOf(root, pick()).slice(0, 2 + Math.floor(r() * 2)), `g${seed}-${step}`, 'G', layers)
          else if (op === 2) next = ungroupNode(root, groups[Math.floor(r() * groups.length)]!, layers)
          else if (op === 3) next = setTreeNodeFlag(root, pick(), 'hidden', r() < 0.5, layers)
          else next = renameTreeNode(root, pick(), `x${step}`, layers)
        } catch (error) {
          if (!(error instanceof ConfigValidationError)) throw error
          expect(JSON.stringify(root)).toBe(before)
          continue
        }
        applied++
        expect(JSON.stringify(root), `seed ${seed} step ${step}: кіріс өзгерді`).toBe(before)
        const ids = nodeIds(next)
        expect(new Set(ids).size).toBe(ids.length)
        if (op <= 2) {
          expect(worldPoses(next), `seed ${seed} step ${step} op ${op}`).toEqual(worldPoses(root))
          // Жасырын топтан шығарылған түйін көрінеді — бұл ата ауыстырудың
          // мағынасы. Сондықтан ата ауыстыруда деталировка тек жасырыны жоқ
          // ағашта салыстырылады; топтау мен таратуда әрқашан.
          if (op !== 0 || !before.includes('"hidden":true')) {
            expect(production(next), `seed ${seed} step ${step} op ${op}`).toEqual(production(root))
          }
        }
        root = freeze(next)
      }
    }
    expect(applied).toBeGreaterThan(500)
  })
})
