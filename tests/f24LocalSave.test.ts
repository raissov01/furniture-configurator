import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_META_KEY, useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'
import { CLOUD_SELECTION_KEY } from '../lib/f24UiLogic'
import { readShareSession, saveShareSession } from '../lib/shareSessionStorage'

const baseline = useConfigurator.getState()
afterEach(() => { useConfigurator.setState(baseline, true); vi.unstubAllGlobals() })

function storage(fail = false, session = new Map<string, string>()) {
  const values = new Map<string, string>()
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw new Error('quota'); values.set(key, value) },
  }, sessionStorage: {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
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

  it('detaches cloud identity and client code when opening another tab project', async () => {
    const session = new Map<string, string>()
    const values = storage(false, session)
    const state = () => useConfigurator.getState()
    const epoch = state().projectEpoch
    const share = { code: '123456', key: 'old-owner', expiresAt: Date.now() + 60_000 }
    useConfigurator.setState({ shareSession: share, localConflict: true })
    saveShareSession(share)
    session.set(CLOUD_SELECTION_KEY, JSON.stringify({ id: 'old-cloud-project', revision: 1 }))
    values.set('furniture-configurator:project', JSON.stringify({ ...state().exportProject(), name: 'Other tab project' }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    state().resolveLocalConflict('other')
    expect(state().projectName).toBe('Other tab project')
    expect(state().projectEpoch).toBe(epoch + 1)
    expect(session.has(CLOUD_SELECTION_KEY)).toBe(false)
    expect(state().shareSession).toBeNull()
    expect(readShareSession()).toBeNull()
    await state().syncShare()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['{', null])('preserves the active identity when the other project cannot be opened: %s', (raw) => {
    const session = new Map<string, string>()
    const values = storage(false, session)
    const state = () => useConfigurator.getState()
    const epoch = state().projectEpoch
    const name = state().projectName
    const share = { code: '123456', key: 'old-owner', expiresAt: Date.now() + 60_000 }
    useConfigurator.setState({ shareSession: share, localConflict: true })
    saveShareSession(share)
    const selection = JSON.stringify({ id: 'old-cloud-project', revision: 1 })
    session.set(CLOUD_SELECTION_KEY, selection)
    if (raw !== null) values.set('furniture-configurator:project', raw)
    state().resolveLocalConflict('other')
    expect(state().projectEpoch).toBe(epoch)
    expect(state().projectName).toBe(name)
    expect(state().localConflict).toBe(true)
    expect(session.get(CLOUD_SELECTION_KEY)).toBe(selection)
    expect(state().shareSession).toEqual(share)
    expect(readShareSession()).toEqual(share)
  })

  it('shows quota failure rather than reporting a saved project', () => {
    storage(true)
    expect(useConfigurator.getState().saveProjectLocally()).toMatch(/quota/)
    expect(useConfigurator.getState().localSaveError).toMatch(/quota/)
  })
})
