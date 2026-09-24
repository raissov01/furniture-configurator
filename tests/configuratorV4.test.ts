import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeProjectV4, encodeProject, flattenTree, parseProjectV4, scenePanels } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
const key = 'furniture-configurator:project'

afterEach(() => {
  useConfigurator.setState({
    root: baseline.root, layers: baseline.layers, room: baseline.room,
    projectSettings: baseline.projectSettings, projectMaterials: baseline.projectMaterials,
    projectEdgeBands: baseline.projectEdgeBands, catalog: baseline.catalog,
    cabinets: baseline.cabinets, placements: baseline.placements,
    activeId: baseline.activeId, past: [], future: [],
    projectLoadError: null,
  })
  vi.unstubAllGlobals()
})

describe('canonical v4 configurator', () => {
  it('migrates a v3 file, exports only root and preserves its manufacturing panels', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const state = useConfigurator.getState()
    const exported = state.exportProject()
    expect(exported.schemaVersion).toBe(4)
    expect('cabinets' in exported).toBe(false)
    expect('placements' in exported).toBe(false)
    expect(exported.root.children).toHaveLength(referenceProject.cabinets.length)
    const catalog = { materials: exported.materials, edgeBands: exported.edgeBands }
    expect(scenePanels(flattenTree(exported.root, catalog, exported.settings, exported.layers)))
      .toEqual(scenePanels(flattenTree(parseProjectV4(referenceProject).root, catalog, exported.settings, exported.layers)))
  })

  it('keeps nested nodes, hides production panels, and restores the change with one undo', () => {
    const file = parseProjectV4(referenceProject)
    const cabinet = file.root.children[0]!
    file.root.children = [{ kind: 'group', id: 'bundle', name: 'Bundle', transform: cabinet.transform,
      children: [{ ...cabinet, transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } } }] }]
    useConfigurator.getState().loadProject(file)
    useConfigurator.getState().setNodeHidden(cabinet.id, true)
    expect(useConfigurator.getState().exportProject().root.children[0]).toMatchObject({ kind: 'group', children: [{ hidden: true }] })
    expect(scenePanels(flattenTree(useConfigurator.getState().root, useConfigurator.getState().catalog, undefined,
      useConfigurator.getState().layers))).toHaveLength(0)
    useConfigurator.getState().undo()
    expect((useConfigurator.getState().root.children[0] as { children: { hidden?: boolean }[] }).children[0]!.hidden).toBeUndefined()
  })

  it('hydrates legacy localStorage without discarding data and saves v4', () => {
    const values = new Map([[key, JSON.stringify(referenceProject)]])
    vi.stubGlobal('window', { localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => values.set(name, value),
    } })
    useConfigurator.getState().hydrateProject()
    useConfigurator.getState().saveProjectLocally()
    expect(JSON.parse(values.get(key)!).schemaVersion).toBe(4)
    expect(useConfigurator.getState().exportProject().root.children).toHaveLength(referenceProject.cabinets.length)
  })

  it('opens a v4 shared URL without dropping nested nodes', () => {
    const file = parseProjectV4(referenceProject)
    file.root.children = [{ kind: 'group', id: 'nested', name: 'Nested', transform: file.root.transform,
      children: file.root.children }]
    expect(decodeProjectV4(encodeProject(file)).root).toEqual(file.root)
  })

  it('uses saved material thickness and settings when local shop reuses the material id', () => {
    const material = referenceProject.materials[0]!
    const different = { ...material, thickness: material.thickness + 2 }
    const file = { ...referenceProject, materials: [different, ...referenceProject.materials.slice(1)],
      settings: { ...baseline.shop.settings, shelfPinDatum: 64 } }
    useConfigurator.getState().loadProject(file)
    const state = useConfigurator.getState()
    expect(state.catalog.materials.find((item) => item.id === material.id)?.thickness).toBe(different.thickness)
    expect(state.projectSettings?.shelfPinDatum).toBe(64)
    expect(state.exportProject().materials.find((item) => item.id === material.id)?.thickness).toBe(different.thickness)
    expect(state.exportProject().settings?.shelfPinDatum).toBe(64)
  })

  it('keeps imported geometry on price edits but applies explicit shop sheet edits', () => {
    const material = referenceProject.materials[0]!
    useConfigurator.getState().loadProject({ ...referenceProject,
      materials: [{ ...material, thickness: material.thickness + 2 }, ...referenceProject.materials.slice(1)] })
    const before = useConfigurator.getState().shop.materials.find((item) => item.id === material.id)!
    useConfigurator.getState().editShop({ materials: useConfigurator.getState().shop.materials.map((item) =>
      item.id === material.id ? { ...item, pricePerSheet: item.pricePerSheet + 1 } : item) })
    expect(useConfigurator.getState().catalog.materials.find((item) => item.id === material.id)?.thickness)
      .toBe(material.thickness + 2)
    useConfigurator.getState().editShop({ materials: useConfigurator.getState().shop.materials.map((item) =>
      item.id === material.id ? { ...item, sheetWidth: before.sheetWidth + 10 } : item) })
    expect(useConfigurator.getState().catalog.materials.find((item) => item.id === material.id)?.sheetWidth)
      .toBe(before.sheetWidth + 10)
    expect(useConfigurator.getState().catalog.materials.find((item) => item.id === material.id)?.thickness)
      .toBe(material.thickness + 2)
  })

  it('applies explicit shop construction settings to the current project and persists them', () => {
    useConfigurator.getState().loadProject({ ...referenceProject,
      settings: { ...baseline.shop.settings, shelfPinDatum: 64 } })
    const changed = { ...useConfigurator.getState().shop.settings, frontGap: 4 }
    useConfigurator.getState().editShop({ settings: changed })
    expect(useConfigurator.getState().exportProject().settings?.frontGap).toBe(4)
    expect(useConfigurator.getState().exportProject().settings?.shelfPinDatum).toBe(64)
  })

  it('does not edit or move a cabinet below a locked group through legacy controls', () => {
    const file = parseProjectV4(referenceProject)
    file.root.children = [{ kind: 'group', id: 'protected', name: 'Protected', locked: true,
      transform: file.root.transform, children: file.root.children }]
    useConfigurator.getState().loadProject(file)
    const original = useConfigurator.getState().root
    expect(() => useConfigurator.getState().edit('width', { width: original.children.length + 999 }))
      .toThrow(/құлып/)
    expect(() => useConfigurator.getState().movePlacement(referenceProject.cabinets[0]!.id, { offset: 90 }))
      .toThrow(/құлып/)
    expect(() => useConfigurator.getState().assignNodeLayer(referenceProject.cabinets[0]!.id, 'default'))
      .toThrow(/құлып/)
    expect(useConfigurator.getState().root).toBe(original)
  })

  it('adds a cabinet when legacy migration retained an unplaced hidden cabinet', () => {
    const file = parseProjectV4({ ...referenceProject, placements: [] })
    useConfigurator.getState().loadProject(file)
    expect(() => useConfigurator.getState().addCabinet()).not.toThrow()
    expect(useConfigurator.getState().exportProject().root.children).toHaveLength(2)
  })

  it('duplicates an unplaced hidden cabinet without assuming it has a wall placement', () => {
    useConfigurator.getState().loadProject(parseProjectV4({ ...referenceProject, placements: [] }))
    expect(() => useConfigurator.getState().duplicateCabinet(referenceProject.cabinets[0]!.id)).not.toThrow()
    expect(useConfigurator.getState().root.children).toHaveLength(2)
  })

  it('does not overwrite an unreadable saved project during hydration', () => {
    const invalid = '{broken json'
    const values = new Map([[key, invalid]])
    vi.stubGlobal('window', { localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => values.set(name, value),
    } })
    useConfigurator.getState().hydrateProject()
    useConfigurator.getState().saveProjectLocally()
    expect(values.get(key)).toBe(invalid)
    expect(useConfigurator.getState().projectLoadError).toMatch(/жоба|JSON/i)
  })
})
