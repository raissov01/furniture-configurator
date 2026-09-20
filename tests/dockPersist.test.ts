/**
 * `components/dock/persist.ts` — талап 5: localStorage-тен бұзылған/ескі
 * күй оқылса, модуль құламауы керек, әдепкіге қайтуы керек, әрі себебін
 * логқа жазуы керек (no silent catch).
 *
 * Node ортасында `window` жоқ, сондықтан `tests/appearance.test.ts`-тегідей
 * `vi.stubGlobal` арқылы жалған `window.localStorage` қоямыз.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDockState, dockPanel } from '../components/dock/layout'
import { DOCK_STORAGE_KEY, loadDockState, saveDockState } from '../components/dock/persist'

function fakeLocalStorage(initial?: Record<string, string>) {
  const store = new Map(Object.entries(initial ?? {}))
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
  }
}

function stubWindow(localStorage: unknown): void {
  vi.stubGlobal('window', { localStorage })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loadDockState — дұрыс сақталған күй', () => {
  it('сақталған, дұрыс күйді оқиды', () => {
    const saved = dockPanel(createDockState(['a', 'b']), 'a', 'left')
    const ls = fakeLocalStorage({ [DOCK_STORAGE_KEY]: JSON.stringify({ version: 1, state: saved }) })
    stubWindow(ls)
    const loaded = loadDockState(['a', 'b'])
    expect(loaded.order.left).toEqual(['a'])
  })

  it('ештеңе сақталмаса — әдепкі күй, лог жазылмайды', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow(fakeLocalStorage())
    const loaded = loadDockState(['a'])
    expect(loaded).toEqual(createDockState(['a']))
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('5. бұзылған/ескі күй — құламайды, әдепкіге қайтады, логқа жазады', () => {
  it('бұзылған JSON: құламайды, әдепкіге қайтады, себебін логқа жазады', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow(fakeLocalStorage({ [DOCK_STORAGE_KEY]: '{ бұзылған json ' }))
    const loaded = loadDockState(['a', 'b'])
    expect(loaded).toEqual(createDockState(['a', 'b']))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/бұзылған JSON/)
  })

  it('ескі схема нұсқасы: құламайды, әдепкіге қайтады, себебін логқа жазады', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow(fakeLocalStorage({ [DOCK_STORAGE_KEY]: JSON.stringify({ version: 0, state: {} }) }))
    const loaded = loadDockState(['a'])
    expect(loaded).toEqual(createDockState(['a']))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/схема нұсқасы/)
  })

  it('пішіні DockState емес (мыс. басқа кілттің мазмұны): құламайды, әдепкіге қайтады, логқа жазады', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow(
      fakeLocalStorage({ [DOCK_STORAGE_KEY]: JSON.stringify({ version: 1, state: { random: 'garbage' } }) }),
    )
    const loaded = loadDockState(['a'])
    expect(loaded).toEqual(createDockState(['a']))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/DockState пішініне сай емес/)
  })

  it('localStorage мүлде null (объект емес) болса да құламайды', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow(fakeLocalStorage({ [DOCK_STORAGE_KEY]: JSON.stringify(null) }))
    const loaded = loadDockState(['a'])
    expect(loaded).toEqual(createDockState(['a']))
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('localStorage.getItem лақтырса (жеке терезе): құламайды, әдепкіге қайтады, логқа жазады', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow({
      getItem: () => {
        throw new Error('SecurityError: жеке терезе')
      },
    })
    const loaded = loadDockState(['a'])
    expect(loaded).toEqual(createDockState(['a']))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/оқылмады/)
  })

  it('window мүлде жоқ (сервер жағы): лақтырмайды, әдепкі күй қайтарады', () => {
    const loaded = loadDockState(['a'])
    expect(loaded).toEqual(createDockState(['a']))
  })
})

describe('saveDockState', () => {
  it('дұрыс жағдайда localStorage-ке версиямен бірге жазады', () => {
    const ls = fakeLocalStorage()
    stubWindow(ls)
    const state = dockPanel(createDockState(['a']), 'a', 'top')
    saveDockState(state)
    const raw = ls.store.get(DOCK_STORAGE_KEY)
    expect(raw).toBeDefined()
    expect(JSON.parse(raw!)).toEqual({ version: 1, state })
  })

  it('setItem лақтырса (квота толған): құламайды, логқа жазады', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubWindow({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => saveDockState(createDockState(['a']))).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/жазылмады/)
  })

  it('window жоқта (сервер жағы) ешнәрсе істемейді, лақтырмайды', () => {
    expect(() => saveDockState(createDockState(['a']))).not.toThrow()
  })
})
