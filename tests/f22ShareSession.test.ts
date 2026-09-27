import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConfigurator } from '../store/configurator'
import { parseShareSession } from '../lib/shareSessionStorage'

const before = useConfigurator.getState()

afterEach(() => {
  useConfigurator.setState(before)
  vi.unstubAllGlobals()
})

describe('F22 клиент коды reload-тен кейін', () => {
  it('мерзімі өткен не қате кілтті қалпына келтірмейді', () => {
    const now = Date.now()
    expect(parseShareSession(JSON.stringify({ code: '123456', key: 'secret', expiresAt: now }), now)).toBeNull()
    expect(parseShareSession(JSON.stringify({ code: '123456', key: '', expiresAt: now + 1000 }), now)).toBeNull()
    expect(parseShareSession('{', now)).toBeNull()
  })

  it('сақталған жобамен бірге сеансты қайтарады және жаңа POST жасамайды', async () => {
    const local = new Map<string, string>()
    const session = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: { getItem: (key: string) => local.get(key) ?? null, setItem: (key: string, value: string) => local.set(key, value) },
      sessionStorage: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) },
    })
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ code: '123456', key: 'secret', expiresAt: Date.now() + 60_000 }))
    vi.stubGlobal('fetch', fetchMock)
    const state = useConfigurator.getState()
    state.saveProjectLocally()
    expect(await state.startShare()).toMatchObject({ ok: true, code: '123456' })
    useConfigurator.setState({ shareSession: null })
    state.hydrateProject()
    expect(useConfigurator.getState().shareSession).toMatchObject({ code: '123456', key: 'secret' })
    expect(await state.startShare()).toMatchObject({ ok: true, code: '123456' })
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1)
  })

  it('басқа жоба ашылғанда бұрынғы кодты қолданбайды', async () => {
    const session = new Map<string, string>()
    vi.stubGlobal('window', { sessionStorage: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } })
    const state = useConfigurator.getState()
    useConfigurator.setState({ shareSession: { code: '123456', key: 'secret', expiresAt: Date.now() + 60_000 } })
    state.loadProject(state.exportProject())
    expect(useConfigurator.getState().shareSession).toBeNull()
  })
})
