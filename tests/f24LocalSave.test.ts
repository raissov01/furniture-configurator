import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_META_KEY, useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
afterEach(() => { useConfigurator.setState(baseline, true); vi.unstubAllGlobals() })

function storage(fail = false) {
  const values = new Map<string, string>()
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw new Error('quota'); values.set(key, value) },
  } })
  return values
}

describe('F24 local save state', () => {
  it('changes project identity on file load and reset', () => {
    const first = useConfigurator.getState().projectEpoch
    useConfigurator.getState().loadProject(referenceProject)
    expect(useConfigurator.getState().projectEpoch).toBe(first + 1)
    useConfigurator.getState().reset()
    expect(useConfigurator.getState().projectEpoch).toBe(first + 2)
  })
  it('stops a stale tab and asks for an explicit version choice', () => {
    const values = storage()
    const state = () => useConfigurator.getState()
    expect(state().saveProjectLocally()).toBeNull()
    const original = values.get('furniture-configurator:project')
    const own = JSON.parse(values.get(PROJECT_META_KEY)!) as { revision: number }
    values.set(PROJECT_META_KEY, JSON.stringify({ revision: own.revision + 1, tabId: 'other-tab' }))
    state().checkLocalRevision()
    expect(state().localConflict).toBe(true)
    expect(state().saveProjectLocally()).toMatch(/басқа қойындыда/)
    expect(values.get('furniture-configurator:project')).toBe(original)
    state().resolveLocalConflict('mine')
    expect(state().localConflict).toBe(false)
    expect(JSON.parse(values.get(PROJECT_META_KEY)!).revision).toBe(own.revision + 2)
  })

  it('shows quota failure rather than reporting a saved project', () => {
    storage(true)
    expect(useConfigurator.getState().saveProjectLocally()).toMatch(/quota/)
    expect(useConfigurator.getState().localSaveError).toMatch(/quota/)
  })
})
