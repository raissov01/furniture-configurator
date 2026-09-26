import { afterEach, describe, expect, it } from 'vitest'
import { findNode, IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, ORIENT_SIDE } from '../src/core/index'
import type { BoardNode, GroupNode } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

const board = (id: string, y: number, horizontal: boolean): BoardNode => ({
  id, name: id, kind: 'board', transform: { pos: { x: 0, y, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
  board: { materialId: baseline.catalog.materials.find((m) => m.thickness === 16)!.id,
    length: 500, width: 300, orientation: horizontal ? ORIENT_HORIZONTAL : ORIENT_SIDE,
    edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: true, role: 'custom',
    drilling: horizontal ? [{ face: 'outer', x: 100, y: 100, diameter: 5, depth: 5, purpose: 'dowel' }] : [] },
})
const tree = (): GroupNode => ({ id: 'root', name: 'root', kind: 'group', transform: IDENTITY_TRANSFORM,
  children: [board('base', 0, true), board('upright', 16, false)] })
const drills = (id: string) => {
  const node = findNode(useConfigurator.getState().root, id)
  if (node?.kind !== 'board') throw new Error(`${id}: board missing`)
  return node.board.drilling ?? []
}

describe('store.autoJointBoards', () => {
  it('қол тесігін сақтайды, қайталағанда қосарламайды, екі тақтаны бір undo қайтарады', () => {
    useConfigurator.setState({ root: tree(), past: [], future: [] })
    const before = drills('base')
    useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    expect(drills('base')).toHaveLength(before.length + 2)
    expect(drills('base')[0]).toEqual(before[0])
    expect(drills('upright')).toHaveLength(2)
    expect(useConfigurator.getState().past).toHaveLength(1)
    useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    expect(drills('base')).toHaveLength(before.length + 2)
    expect(useConfigurator.getState().past).toHaveLength(1)
    useConfigurator.getState().undo()
    expect(drills('base')).toEqual(before)
    expect(drills('upright')).toEqual([])
  })

  it('қолмен жылжытылған конфирматты қайта автомат қоспайды', () => {
    useConfigurator.setState({ root: tree(), past: [], future: [] })
    useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    const edited = drills('base').map((hole) => hole.purpose === 'confirmat' ? { ...hole, x: hole.x + 1 } : hole)
    useConfigurator.getState().editBoard('base', { drilling: edited })
    const before = [drills('base'), drills('upright')]
    const history = useConfigurator.getState().past.length
    expect(() => useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)).toThrow(/қолмен/)
    expect([drills('base'), drills('upright')]).toEqual(before)
    expect(useConfigurator.getState().past).toHaveLength(history)
  })

  it('тақта орны өзгерсе ескі автомат тесіктердің қасына жаңасын қоспайды', () => {
    useConfigurator.setState({ root: tree(), past: [], future: [] })
    useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    useConfigurator.getState().setBoardPosition('upright', { x: 0, y: 16, z: 20 })
    const before = [drills('base'), drills('upright')]
    expect(() => useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)).toThrow(/қолмен/)
    expect([drills('base'), drills('upright')]).toEqual(before)
  })
})

describe('store.autoJointBoards: бір тақта бірнеше буында', () => {
  it('дноның екінші боковинамен буыны біріншісінің тесігіне қайшы деп саналмайды', () => {
    const right = { ...board('right', 16, false), transform: { pos: { x: 484, y: 16, z: 0 }, rot: { x: 0, y: 0, z: 0 } } }
    useConfigurator.setState({ root: { ...tree(), children: [...tree().children, right] }, past: [], future: [] })
    const before = drills('base').length
    useConfigurator.getState().autoJointBoards(['base', 'upright'], 'confirmat', 0)
    useConfigurator.getState().autoJointBoards(['base', 'right'], 'confirmat', 0)
    expect(drills('base').filter((hole) => hole.purpose === 'confirmat')).toHaveLength(4)
    expect(drills('base')).toHaveLength(before + 4)
    expect(drills('right')).toHaveLength(2)
    expect(drills('upright')).toHaveLength(2)
  })
})
