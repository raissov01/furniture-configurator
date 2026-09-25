import { describe, expect, it } from 'vitest'
import { arrayNodes } from '../src/core/array'
import { IDENTITY_TRANSFORM } from '../src/core/tree'
import type { SolidNode } from '../src/core/tree'

const node: SolidNode = { kind: 'solid', id: 'fixture', name: 'Блок', transform: structuredClone(IDENTITY_TRANSFORM), solid: { size: { x: 10, y: 20, z: 30 } } }

describe('сызықтық массив', () => {
  it('N көшірмеге жаңа id, ат және өс бойымен бүтін қадам береді', () => {
    const result = arrayNodes(node, { axis: 'z', count: 3, step: -40 })
    expect(result.map((entry) => [entry.id, entry.name, entry.transform.pos.z])).toEqual([
      ['fixture-array-1', 'Блок 1', -40], ['fixture-array-2', 'Блок 2', -80], ['fixture-array-3', 'Блок 3', -120],
    ])
    expect(node.transform.pos.z).toBe(0)
    expect(result[0]).not.toBe(node)
  })
  it('топ балаларын көшіріп, олардың id-лерін де бірегей қылады', () => {
    const result = arrayNodes({ kind: 'group', id: 'g', name: 'Жинақ', transform: structuredClone(IDENTITY_TRANSFORM), children: [node] },
      { axis: 'x', count: 2, step: 100 })
    expect(result.map((entry) => entry.id)).toEqual(['g-array-1', 'g-array-2'])
    expect(result.map((entry) => entry.kind === 'group' ? entry.children[0]?.id : '')).toEqual(['fixture-array-1', 'fixture-array-2'])
  })
  it('қайта шақырғанда id индексі ғана өседі, аралық қадам сақталады және ішкі дерек бөлектенеді', () => {
    const result = arrayNodes(node, { axis: 'x', count: 2, step: 25, startIndex: 3 })
    expect(result.map((entry) => entry.transform.pos.x)).toEqual([25, 50])
    expect(result.map((entry) => entry.id)).toEqual(['fixture-array-3', 'fixture-array-4'])
    if (result[0]?.kind === 'solid') result[0].solid.size.x = 999
    expect(node.solid.size.x).toBe(10)
  })
  it('параметрлік шкафтың ішкі config.id-і көшірме id-іне тең болады', () => {
    const cabinet = { kind: 'cabinet' as const, id: 'cab', name: 'Шкаф', transform: structuredClone(IDENTITY_TRANSFORM), config: { id: 'cab', name: 'Шкаф' } }
    const result = arrayNodes(cabinet as Parameters<typeof arrayNodes>[0], { axis: 'x', count: 1, step: 100 })
    expect(result[0]?.kind === 'cabinet' && result[0].config.id).toBe('cab-array-1')
  })
  it('count, step және орын қауіпсіз бүтін мм', () => {
    expect(() => arrayNodes(node, { axis: 'x', count: 0, step: 5 })).toThrow(/count/)
    expect(() => arrayNodes(node, { axis: 'x', count: 2, step: 0.5 })).toThrow(/step/)
    expect(() => arrayNodes(node, { axis: 'x', count: 2, step: Number.MAX_SAFE_INTEGER })).toThrow(/transform.pos.x/)
  })
})
