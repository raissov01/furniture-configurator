import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEED_SETS, findNode, flattenTree, parseProjectV4, scenePanels } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
const s = () => useConfigurator.getState()
afterEach(() => { useConfigurator.setState(baseline, true); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const localStore = () => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  } })
  return values
}

describe('v4 редактор тәуекелдері', () => {
  it('v3 бос қабат тізімінен әдепкі қабатты көрсетеді', () => {
    s().loadProject({ ...referenceProject, layers: [] })
    expect(s().layers).toHaveLength(1)
    expect(s().layers[0]?.id).toBe('default')
  })

  it('жоба settings-і цех settings-інен басым: UI мен CLI бір өндіріс панелін береді', () => {
    const file = parseProjectV4({ ...referenceProject,
      settings: { ...s().shop.settings, shelfPinDatum: 64 } })
    s().loadProject(file)
    const ui = s()
    expect(ui.shop.settings.shelfPinDatum).not.toBe(64)
    const uiPanels = scenePanels(flattenTree(ui.root, ui.catalog, ui.projectSettings ?? ui.shop.settings, ui.layers))
    const cliPanels = scenePanels(flattenTree(file.root,
      { materials: file.materials, edgeBands: file.edgeBands }, file.settings, file.layers))
    const manufacturing = (panels: typeof uiPanels) => panels.map((panel) => ({
      id: panel.id, cutLength: panel.cutLength, cutWidth: panel.cutWidth,
      shelfPins: panel.drilling.filter((drill) => drill.purpose === 'shelfPin'),
    }))
    expect(manufacturing(uiPanels)).toEqual(manufacturing(cliPanels))
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

  it('бүлінген local жобаны бөлек backup-қа жазып, қалпына келтіргенше автосақтамайды', () => {
    const values = localStore()
    const key = 'furniture-configurator:project'
    const backup = 'furniture-configurator:project-corrupt-backup'
    values.set(key, '{invalid JSON')
    s().hydrateProject()
    expect(s().projectLoadError).toMatch(/оқылмады/)
    expect(s().firstRun).toBe(false)
    expect(values.get(backup)).toBe('{invalid JSON')
    s().saveProjectLocally()
    expect(values.get(key)).toBe('{invalid JSON')
    s().reset()
    expect(s().projectLoadError).toBeNull()
    expect(JSON.parse(values.get(key)!).schemaVersion).toBe(4)
    expect(values.get(backup)).toBe('{invalid JSON')
  })

  it('localStorage оқылмаса, сақтық көшірме жасалды деп мәлімдемейді', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked') } } })
    s().hydrateProject()
    expect(s().projectLoadError).toMatch(/сақтық көшірме жазылмады/)
    expect(s().firstRun).toBe(false)
  })

  it('тарихтан қайтару PROJECT_KEY-ге дереу жазылады; бүлінген тарих қатесі көрінеді', () => {
    const values = localStore()
    const key = 'furniture-configurator:project'
    values.set(key, '{invalid JSON')
    s().hydrateProject()
    values.set('furniture-configurator:history', JSON.stringify([
      { at: 7, name: 'Жарамды', json: JSON.stringify(parseProjectV4(referenceProject)) },
      { at: 8, name: 'Бүлінген', json: '{bad' },
    ]))
    s().restoreHistory(8)
    expect(s().historyRestoreError).toMatch(/тарих|Тарих/)
    expect(values.get(key)).toBe('{invalid JSON')
    s().restoreHistory(7)
    expect(s().projectLoadError).toBeNull()
    expect(s().historyRestoreError).toBeNull()
    expect(JSON.parse(values.get(key)!).schemaVersion).toBe(4)
  })

  it('жарамды жобада бүлінген тарих автосақтауды бөгемейді', () => {
    const values = localStore()
    const key = 'furniture-configurator:project'
    values.set(key, JSON.stringify(parseProjectV4(referenceProject)))
    s().hydrateProject()
    values.set('furniture-configurator:history', JSON.stringify([{ at: 9, json: '{bad' }]))
    s().restoreHistory(9)
    expect(s().historyRestoreError).toMatch(/Тарих/)
    expect(s().projectLoadError).toBeNull()
    s().renameNode(s().cabinets[0]!.id, 'Жаңа атау')
    s().saveProjectLocally()
    expect(JSON.parse(values.get(key)!).root.children[0].name).toBe('Жаңа атау')
  })

  it('PROJECT_KEY жазу сәтсіз болса, тарихтан қайтару мен reset қате күйінде қалады', () => {
    const values = new Map<string, string>()
    const key = 'furniture-configurator:project'
    values.set(key, '{invalid JSON')
    vi.stubGlobal('window', { localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => {
        if (name === key) throw new Error('quota')
        values.set(name, value)
      },
    } })
    s().hydrateProject()
    values.set('furniture-configurator:history', JSON.stringify([
      { at: 10, name: 'Жарамды', json: JSON.stringify(parseProjectV4(referenceProject)) },
    ]))
    s().restoreHistory(10)
    expect(s().projectLoadError).toMatch(/quota|жазылмады/)
    expect(values.get(key)).toBe('{invalid JSON')
    s().reset()
    expect(s().projectLoadError).toMatch(/quota|жазылмады/)
    expect(values.get(key)).toBe('{invalid JSON')
  })
})
