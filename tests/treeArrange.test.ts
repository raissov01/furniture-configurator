import { describe, expect, it } from 'vitest'
import { appendNodeArray, translateTreeNodes } from '../src/core/treeEditing'
import { IDENTITY_TRANSFORM, findNode, walkTree } from '../src/core/tree'
import type { GroupNode, SolidNode } from '../src/core/tree'

const solid = (id: string, x: number): SolidNode => ({ kind: 'solid', id, name: id, transform: { pos: { x, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, solid: { size: { x: 10, y: 20, z: 30 } } })
const root = (): GroupNode => ({ kind: 'group', id: 'root', name: 'root', transform: structuredClone(IDENTITY_TRANSFORM), children: [
  solid('a', 0), solid('b', 100), { kind: 'group', id: 'g', name: 'g', transform: { pos: { x: 200, y: 0, z: 0 }, rot: { x: 0, y: 90, z: 0 } }, children: [solid('c', 10)] },
] })

describe('ағашты массивтеу және көп нысанды көшіру', () => {
  it('массивті бастапқы түйіннен кейін орналастырады; қайта шақыру id қайталамайды', () => {
    const first = appendNodeArray(root(), 'a', { axis: 'x', count: 2, step: 25 }, [])
    expect(first.children.map((n) => n.id)).toEqual(['a', 'a-array-1', 'a-array-2', 'b', 'g'])
    const second = appendNodeArray(first, 'a', { axis: 'x', count: 2, step: 25 }, [])
    expect(second.children.map((n) => n.id)).toEqual(['a', 'a-array-3', 'a-array-4', 'a-array-1', 'a-array-2', 'b', 'g'])
    expect(findNode(second, 'a-array-3')?.transform.pos.x).toBe(25)
  })
  it('бұрылған ата ішінде массив қадамын әлемнің X/Y/Z осімен өлшейді', () => {
    const original = root()
    const xArray = appendNodeArray(original, 'c', { axis: 'x', count: 2, step: 100 }, [])
    const positions = new Map<string, { x: number; y: number; z: number }>()
    walkTree(xArray, (entry, pose) => positions.set(entry.id, pose.position))
    expect(positions.get('c-array-1')).toEqual({ x: 300, y: 0, z: -10 })
    expect(positions.get('c-array-2')).toEqual({ x: 400, y: 0, z: -10 })
    expect(findNode(xArray, 'c-array-1')?.transform.pos).toEqual({ x: 10, y: 0, z: 100 })

    const yArray = appendNodeArray(original, 'c', { axis: 'y', count: 1, step: 100 }, [])
    expect(findNode(yArray, 'c-array-1')?.transform.pos).toEqual({ x: 10, y: 100, z: 0 })
    const zArray = appendNodeArray(original, 'c', { axis: 'z', count: 1, step: 100 }, [])
    expect(findNode(zArray, 'c-array-1')?.transform.pos).toEqual({ x: -90, y: 0, z: 0 })
  })
  it('әлемдегі дельтаны бұрылған атаға қатысты дұрыс аударады', () => {
    const result = translateTreeNodes(root(), [{ id: 'c', delta: { x: 0, y: 0, z: -20 } }], [])
    expect(findNode(result, 'c')?.transform.pos).toEqual({ x: 30, y: 0, z: 0 })
    expect(findNode(root(), 'c')?.transform.pos.x).toBe(10)
  })
  it('нөлдік ығысу жаңа тарих жасамайды және топ+баланы бірге жылжытпайды', () => {
    const tree = root()
    expect(translateTreeNodes(tree, [{ id: 'a', delta: { x: 0, y: 0, z: 0 } }], [])).toBe(tree)
    expect(() => translateTreeNodes(tree, [
      { id: 'g', delta: { x: 10, y: 0, z: 0 } }, { id: 'c', delta: { x: 10, y: 0, z: 0 } },
    ], [])).toThrow(/nodeIds/)
  })
  it('ыңғайсыз үлкен дельта қауіпсіз мм шегінен өтпейді', () => {
    expect(() => translateTreeNodes(root(), [{ id: 'b', delta: { x: Number.MAX_SAFE_INTEGER, y: 0, z: 0 } }], []))
      .toThrow(/delta.x|transform.pos.x/)
  })
  it('екі нысанды бір immutable әрекетте жылжытады және құлыптыны қабылдамайды', () => {
    const result = translateTreeNodes(root(), [
      { id: 'a', delta: { x: 5, y: 0, z: 0 } }, { id: 'b', delta: { x: -5, y: 0, z: 0 } },
    ], [])
    expect(findNode(result, 'a')?.transform.pos.x).toBe(5)
    expect(findNode(result, 'b')?.transform.pos.x).toBe(95)
    const locked = root(); locked.children[0]!.locked = true
    expect(() => translateTreeNodes(locked, [{ id: 'a', delta: { x: 1, y: 0, z: 0 } }], [])).toThrow(/құлып|locked/)
  })
})
