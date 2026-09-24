import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, parseProjectV4, SEED_CATALOG, SEED_SETS, setToProject } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
const local = new Map<string, string>()
beforeEach(() => {
  local.clear()
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
  } })
})
afterEach(() => { useConfigurator.setState(baseline, true); vi.unstubAllGlobals() })

describe('v4 store and shop integration', () => {
  it('preserves all current shop settings on the first project override and across reload', () => {
    useConfigurator.getState().setShop({ ...baseline.shop, settings: {
      shelfPinFrontOffset: 50, hingeCupMount: 'cup-only', runnerBallHoleOffsets: [37, 101, 165],
    } })
    expect(useConfigurator.getState().projectSettings).toBeUndefined()
    useConfigurator.getState().editShop({ settings: { ...useConfigurator.getState().shop.settings, frontGap: 4 } })
    const expected = { shelfPinFrontOffset: 50, hingeCupMount: 'cup-only',
      runnerBallHoleOffsets: [37, 101, 165], frontGap: 4 }
    expect(useConfigurator.getState().exportProject().settings).toEqual(expected)
    useConfigurator.getState().saveProjectLocally()
    useConfigurator.setState({ projectSettings: undefined })
    useConfigurator.getState().hydrateProject()
    expect(useConfigurator.getState().exportProject().settings).toEqual(expected)
  })

  it('changes only edited enum/array keys and supports resetting them', () => {
    useConfigurator.getState().setShop({ ...baseline.shop, settings: {
      runnerBallHoleOffsets: [37, 101], outerFlipAxis: 'length',
    } })
    useConfigurator.setState({ projectSettings: { runnerBallHoleOffsets: [50, 114], shelfPinDatum: 64 } })
    useConfigurator.getState().editShop({ settings: {
      runnerBallHoleOffsets: [37, 101], outerFlipAxis: 'width',
    } })
    expect(useConfigurator.getState().exportProject().settings)
      .toEqual({ runnerBallHoleOffsets: [50, 114], shelfPinDatum: 64, outerFlipAxis: 'width' })
    useConfigurator.getState().editShop({ settings: { runnerBallHoleOffsets: [37, 101] } })
    expect(useConfigurator.getState().exportProject().settings)
      .toEqual({ runnerBallHoleOffsets: [50, 114], shelfPinDatum: 64 })
  })

  it('preserves project title independently of the scene root name in load/save/hydrate/undo', () => {
    const file = parseProjectV4(referenceProject)
    file.name = 'Тапсырыс №123'
    file.root.name = 'Сахна'
    useConfigurator.getState().loadProject(file)
    expect(useConfigurator.getState().exportProject()).toMatchObject({ name: file.name, root: { name: 'Сахна' } })
    useConfigurator.getState().saveProjectLocally()
    useConfigurator.getState().reset()
    useConfigurator.getState().hydrateProject()
    expect(useConfigurator.getState().exportProject().name).toBe(file.name)
    useConfigurator.getState().loadProject({ ...file, name: 'Басқа тапсырыс' })
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().exportProject().name).toBe(file.name)
  })

  it('keeps local template defaults for legacy materials without replacing imported thickness', () => {
    const material = referenceProject.materials[0]!
    useConfigurator.getState().loadProject({ ...referenceProject,
      materials: [{ ...material, thickness: material.thickness + 2 }, ...referenceProject.materials.slice(1)] })
    const current = useConfigurator.getState().catalog.materials.find((entry) => entry.id === material.id)!
    expect(current.thickness).toBe(material.thickness + 2)
    expect(current.defaultEdging).toBeDefined()
    expect(() => useConfigurator.getState().loadTemplate('wardrobe-penal-600')).not.toThrow()
  })

  const actions = [
    { name: 'loadSet', run: () => useConfigurator.getState().loadSet(SEED_SETS[0]!.id) },
    { name: 'loadKitchen', run: () => useConfigurator.getState().loadKitchen({ layout: 'straight', lengthA: 3000 }) },
    { name: 'loadFurniture', run: () => useConfigurator.getState().loadFurniture({ type: 'wardrobe', layout: 'straight', lengthA: 3000 }) },
  ]
  it.each(actions)('$name replaces all scene content and restores it with one undo', ({ run }) => {
    const file = parseProjectV4({ ...referenceProject,
      materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands })
    // This is a valid old node ID which the chosen set will also generate.
    const collision = setToProject(SEED_SETS[0]!, SEED_CATALOG).cabinets[0]!.id
    file.root.children.push({ kind: 'group', id: 'old-group', name: 'Ескі топ', transform: IDENTITY_TRANSFORM,
      children: [{ kind: 'board', id: collision, name: 'Ескі тақта', transform: IDENTITY_TRANSFORM,
        board: { materialId: referenceProject.materials[0]!.id, length: 600, width: 400,
          orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: false,
          edges: { L1: null, L2: null, W1: null, W2: null } } },
      { kind: 'solid', id: 'old-solid', name: 'Ескі декор', transform: IDENTITY_TRANSFORM,
        solid: { size: { x: 100, y: 100, z: 100 } } }] })
    useConfigurator.getState().loadProject(file)
    const before = useConfigurator.getState().root
    const historyLength = useConfigurator.getState().past.length
    run()
    const after = useConfigurator.getState().exportProject()
    expect(after.root.children.length).toBeGreaterThan(0)
    expect(after.root.children.every((node) => node.kind === 'cabinet')).toBe(true)
    expect(() => parseProjectV4(after)).not.toThrow()
    expect(useConfigurator.getState().past).toHaveLength(historyLength + 1)
    useConfigurator.getState().undo()
    expect(useConfigurator.getState().root).toEqual(before)
    useConfigurator.getState().redo()
    expect(useConfigurator.getState().root).toEqual(after.root)
  })
})
