import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEED_SETS, findNode, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
const s = () => useConfigurator.getState()
afterEach(() => { useConfigurator.setState(baseline, true); vi.restoreAllMocks() })

describe('v4 редактор тәуекелдері', () => {
  it('v3 бос қабат тізімінен әдепкі қабатты көрсетеді', () => {
    s().loadProject({ ...referenceProject, layers: [] })
    expect(s().layers).toHaveLength(1)
    expect(s().layers[0]?.id).toBe('default')
  })

  it('бір миллисекундтағы көшірме, айна және қабат ID-лері қайталанбайды', () => {
    s().loadProject(referenceProject)
    vi.spyOn(Date, 'now').mockReturnValue(123)
    const source = s().cabinets[0]!.id
    s().duplicateCabinet(source)
    s().duplicateCabinet(source)
    s().mirrorCabinet(source)
    s().createLayer('Бірінші')
    s().createLayer('Екінші')
    const ids = s().cabinets.map((cabinet) => cabinet.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(s().layers.map((layer) => layer.id)).size).toBe(s().layers.length)
  })

  it('өз ата-түйініне жылжыту және өзгермеген hidden undo қадамын қоспайды', () => {
    s().loadProject(referenceProject)
    const id = s().cabinets[0]!.id
    const before = s().past.length
    s().reparent(id, s().root.id)
    s().setNodeHidden(id, false)
    expect(s().past).toHaveLength(before)
    expect(findNode(s().root, id)?.hidden).toBeUndefined()
  })

  it('redo тарихты HISTORY_LIMIT ішінде ұстайды', () => {
    s().loadProject(referenceProject)
    const id = s().cabinets[0]!.id
    for (let i = 0; i < 101; i++) s().renameNode(id, `Атау ${i}`)
    for (let i = 0; i < 100; i++) s().undo()
    for (let i = 0; i < 100; i++) s().redo()
    expect(s().past.length).toBeLessThanOrEqual(100)
  })

  it('жиынтық жүктеу бұрынғы board/solid түйіндерін тазалайды', () => {
    const file = parseProjectV4(referenceProject)
    file.root.children.push({ kind: 'solid', id: 'old-solid', name: 'Ескі декор', transform: file.root.transform,
      solid: { size: { x: 100, y: 100, z: 100 } } })
    s().loadProject(file)
    s().loadSet(SEED_SETS[0]!.id)
    expect(findNode(s().root, 'old-solid')).toBeUndefined()
  })
})
