import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'
import { findNode, IDENTITY_TRANSFORM } from '../src/core/tree'
import type { GroupNode } from '../src/core/tree'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))
const root = (): GroupNode => ({ kind: 'group', id: 'root', name: 'root', transform: structuredClone(IDENTITY_TRANSFORM), children: [
  { kind: 'solid', id: 'solid', name: 'Блок', transform: structuredClone(IDENTITY_TRANSFORM), solid: { size: { x: 10, y: 20, z: 30 } } },
] })

describe('массив және көптік жылжу тарихы', () => {
  it('әр массив бір undo жазбасы; undo/redo түйіндерді қайтарады', () => {
    useConfigurator.setState({ root: root(), past: [], future: [] })
    useConfigurator.getState().arrayNode('solid', { axis: 'x', count: 2, step: 100 })
    expect(useConfigurator.getState().past).toHaveLength(1)
    expect(findNode(useConfigurator.getState().root, 'solid-array-2')?.transform.pos.x).toBe(200)
    useConfigurator.getState().undo()
    expect(findNode(useConfigurator.getState().root, 'solid-array-2')).toBeUndefined()
    useConfigurator.getState().redo()
    expect(findNode(useConfigurator.getState().root, 'solid-array-2')).toBeDefined()
  })
  it('туралау бір undo қадамын жасайды', () => {
    useConfigurator.setState({ root: root(), past: [], future: [] })
    useConfigurator.getState().arrayNode('solid', { axis: 'x', count: 1, step: 100 })
    useConfigurator.setState({ past: [], future: [] })
    useConfigurator.getState().arrangeNodes(['solid', 'solid-array-1'], 'x', 'max')
    expect(findNode(useConfigurator.getState().root, 'solid')?.transform.pos.x).toBe(100)
    expect(useConfigurator.getState().past).toHaveLength(1)
    useConfigurator.getState().undo()
    expect(findNode(useConfigurator.getState().root, 'solid')?.transform.pos.x).toBe(0)
  })
  it('сүйреудің бірнеше аралық қозғалысы бір undo қадамына жиналады', () => {
    useConfigurator.setState({ root: root(), past: [], future: [] })
    useConfigurator.getState().translateNodes([{ id: 'solid', delta: { x: 10, y: 0, z: 0 } }])
    useConfigurator.getState().translateNodes([{ id: 'solid', delta: { x: 20, y: 0, z: 0 } }], { continueGesture: true })
    expect(findNode(useConfigurator.getState().root, 'solid')?.transform.pos.x).toBe(30)
    expect(useConfigurator.getState().past).toHaveLength(1)
    useConfigurator.getState().undo()
    expect(findNode(useConfigurator.getState().root, 'solid')?.transform.pos.x).toBe(0)
  })
  it('екі нысан бір undo қадамымен ауысады', () => {
    useConfigurator.setState({ root: root(), past: [], future: [] })
    useConfigurator.getState().arrayNode('solid', { axis: 'x', count: 1, step: 100 })
    useConfigurator.setState({ past: [], future: [] })
    useConfigurator.getState().translateNodes([
      { id: 'solid', delta: { x: 5, y: 0, z: 0 } },
      { id: 'solid-array-1', delta: { x: -5, y: 0, z: 0 } },
    ])
    expect(useConfigurator.getState().past).toHaveLength(1)
    expect(findNode(useConfigurator.getState().root, 'solid-array-1')?.transform.pos.x).toBe(95)
    useConfigurator.getState().undo()
    expect(findNode(useConfigurator.getState().root, 'solid-array-1')?.transform.pos.x).toBe(100)
  })
})
