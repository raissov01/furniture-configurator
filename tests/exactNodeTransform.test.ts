import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { findNode, flattenTree, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { GroupProperties } from '../components/GroupProperties'
import { SolidProperties } from '../components/SolidProperties'

const baseline = useConfigurator.getState()
const state = () => useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

describe('топ пен декордың дәл трансформы', () => {
  it('топтың X/Y/Z орнын және Y бұрышын бір undo қадамымен өзгертеді, v4-пен сақтайды', () => {
    const a = state().addSolid()
    const b = state().addSolid()
    state().groupSelected([a, b], 'test-group', 'Топ')
    const before = findNode(state().root, 'test-group')
    expect(before?.kind).toBe('group')
    const past = state().past.length
    state().setNodeTransform('test-group', { pos: { x: 120, y: 40, z: -70 }, rot: { x: 0, y: 37, z: 0 } })
    expect(state().past).toHaveLength(past + 1)
    expect(findNode(state().root, 'test-group')?.transform).toEqual({ pos: { x: 120, y: 40, z: -70 }, rot: { x: 0, y: 37, z: 0 } })
    expect(findNode(parseProjectV4(state().exportProject()).root, 'test-group')?.transform).toEqual(findNode(state().root, 'test-group')?.transform)
    const scene = flattenTree(state().root, state().catalog, state().projectSettings ?? state().shop.settings, state().layers)
    expect(scene.solids.find((solid) => solid.nodeId === a)?.pose.rotationY).toBe(37)
    state().undo()
    expect(findNode(state().root, 'test-group')).toEqual(before)
  })

  it('декордың бұрылысын сақтайды және бүтін емес орын мен X/Z бұрылысын қабылдамайды', () => {
    const id = state().addSolid()
    const prior = findNode(state().root, id)?.transform
    state().setNodeTransform(id, { pos: { x: 10, y: 20, z: 30 }, rot: { x: 0, y: 45, z: 0 } })
    expect(findNode(state().root, id)?.transform.rot.y).toBe(45)
    state().undo()
    expect(findNode(state().root, id)?.transform).toEqual(prior)
    const root = state().root
    expect(() => state().setNodeTransform(id, { pos: { x: 1.5, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } })).toThrow(/transform.pos.x/)
    expect(() => state().setNodeTransform(id, { pos: { x: 0, y: 0, z: 0 }, rot: { x: 5, y: 0, z: 0 } })).toThrow(/transform.rot/)
    expect(state().root).toBe(root)
  })

  it('топ пен декор Properties ішінде бірдей төрт дәл өрісті көрсетеді', () => {
    const a = state().addSolid()
    const b = state().addSolid()
    state().groupSelected([a, b], 'g', 'Топ')
    const group = findNode(state().root, 'g')
    const solid = findNode(state().root, a)
    if (group?.kind !== 'group' || solid?.kind !== 'solid') throw new Error('түйін жоқ')
    for (const html of [renderToStaticMarkup(createElement(GroupProperties, { node: group })),
      renderToStaticMarkup(createElement(SolidProperties, { node: solid }))]) {
      expect(html).toContain('data-testid="exact-transform"')
      expect(html).toContain('X, мм')
      expect(html).toContain('Y, °')
      expect(html).toContain('Применить положение')
    }
  })
})
