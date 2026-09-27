/** CDP boundary fixtures run the real browser expressions, including exceptions. */
import { createContext, runInContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureFailureSnapshot, makeHelpers, serializeCapture } from '../scripts/e2eHelpers.mjs'

function browser() {
  const state = {
    width: '600',
    canvas: null as null | { getBoundingClientRect(): { x: number; y: number; width: number; height: number } },
    cloudNames: [] as string[],
    body: '' as string | null,
    disabled: false,
    clicked: false,
    savedProject: null as string | null,
  }
  const button = {
    textContent: 'Сохранить текущий',
    get disabled() { return state.disabled },
    click() { if (!state.disabled) state.clicked = true },
  }
  const context = createContext({
    localStorage: { getItem: () => state.savedProject },
    document: {
      get body() { return state.body === null ? null : { innerText: state.body } },
      querySelector(selector: string) {
        if (selector === '#scene-3d canvas') return state.canvas
        throw new Error(`Unexpected selector: ${selector}`)
      },
      querySelectorAll(selector: string) {
        if (selector === 'label') return [{
          textContent: 'Ширина (W)',
          querySelector: () => ({ value: state.width }),
        }]
        if (selector === 'button, a') return [button]
        if (selector === '.fixed.inset-0.z-50 li button > .font-medium') {
          return state.cloudNames.map((textContent) => ({ textContent }))
        }
        throw new Error(`Unexpected selector: ${selector}`)
      },
    },
  })
  const send = async (_method: string, { expression }: { expression: string }) => {
    try {
      return { result: { value: await runInContext(expression, context) as unknown } }
    } catch (error) {
      return { exceptionDetails: { text: 'Uncaught', exception: { description: String(error) } } }
    }
  }
  return { state, h: makeHelpers({ send }, 'http://localhost:3093') }
}

afterEach(() => vi.useRealTimers())

describe('e2e browser readiness and evidence', () => {
  it('serializes simultaneous screenshots on one CDP session', async () => {
    const releases: ((value: string) => void)[] = []
    const capture = vi.fn((name: string) => new Promise<string>((resolve) => { releases.push(resolve) }))
    const safe = serializeCapture(capture)
    const first = safe('first')
    const second = safe('second')
    await Promise.resolve()
    expect(capture).toHaveBeenCalledTimes(1)
    releases[0]!('first.png')
    expect(await first).toBe('first.png')
    await Promise.resolve()
    expect(capture).toHaveBeenCalledTimes(2)
    releases[1]!('second.png')
    expect(await second).toBe('second.png')
  })

  it('keeps the failed check visible when Chrome cannot capture a screenshot', async () => {
    const result = await captureFailureSnapshot(() => Promise.reject(new Error('CDP Page.captureScreenshot не ответил за 60 с')))
    expect(result).toEqual({ error: 'CDP Page.captureScreenshot не ответил за 60 с' })
  })
  it('retries only a transient browser fetch during a dev server restart', async () => {
    vi.useFakeTimers()
    const { h } = browser()
    let attempts = 0
    const read = () => {
      attempts += 1
      if (attempts < 3) return Promise.reject(new Error('TypeError: Failed to fetch'))
      return Promise.resolve([{ id: 'saved-project' }])
    }
    const result = h.retryTransientFetch(read, 2000, 400)
      .then((value: unknown) => ({ value }), (error: unknown) => ({ error }))
    await vi.advanceTimersByTimeAsync(800)
    expect(await result).toEqual({ value: [{ id: 'saved-project' }] })
    expect(attempts).toBe(3)
  })

  it('surfaces a real project API error without retrying it', async () => {
    const { h } = browser()
    let attempts = 0
    await expect(h.retryTransientFetch(() => {
      attempts += 1
      return Promise.reject(new Error('GET /api/projects: 403'))
    }, 2000)).rejects.toThrow(/403/)
    expect(attempts).toBe(1)
  })

  it('waits for the document body before evaluating a viewer result', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    state.body = null
    setTimeout(() => { state.body = 'Ссылка не открылась' }, 1200)
    const result = h.until("document.body.innerText.includes('Ссылка не открылась')", 2000)
      .then((value: boolean) => ({ value }), (error: unknown) => ({ error }))
    await vi.advanceTimersByTimeAsync(1600)
    expect(await result).toEqual({ value: true })
  })

  it('reads text after a cold page creates its body', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    state.body = null
    setTimeout(() => { state.body = 'Ссылка не открылась' }, 1200)
    const result = h.text().then((value: string) => ({ value }), (error: unknown) => ({ error }))
    await vi.advanceTimersByTimeAsync(1600)
    expect(await result).toEqual({ value: 'Ссылка не открылась' })
  })

  it('finds the exact saved cabinet width inside nested v4 groups', async () => {
    const { state, h } = browser()
    state.savedProject = JSON.stringify({ schemaVersion: 4, root: {
      kind: 'group', children: [{ kind: 'group', children: [
        { kind: 'cabinet', config: { width: 1234 } },
      ] }],
    } })
    expect(await h.waitForSavedCabinetWidth(1234, 0)).toBe(true)
  })

  it('does not accept an unrelated v4 board width or a stale legacy cabinet', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    state.savedProject = JSON.stringify({ schemaVersion: 4,
      cabinets: [{ width: 1234 }],
      root: { kind: 'group', children: [
        { kind: 'board', board: { width: 1234 } },
        { kind: 'cabinet', config: { width: 600 } },
      ] },
    })
    const result = h.waitForSavedCabinetWidth(1234, 800)
    await vi.advanceTimersByTimeAsync(1200)
    expect(await result).toBe(false)
  })

  it('keeps the same persisted-width assertion for a legacy v3 project', async () => {
    const { state, h } = browser()
    state.savedProject = JSON.stringify({ schemaVersion: 3, cabinets: [{ width: 1234 }] })
    expect(await h.waitForSavedCabinetWidth(1234, 0)).toBe(true)
  })

  it('waits until autosave actually stores the expected v4 width', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    let completed = false
    const result = h.waitForSavedCabinetWidth(1234, 2000)
      .then((value: boolean) => { completed = true; return { value } }, (error: unknown) => ({ error }))
    await vi.advanceTimersByTimeAsync(800)
    expect(completed).toBe(false)
    state.savedProject = JSON.stringify({ schemaVersion: 4, root: {
      kind: 'group', children: [{ kind: 'cabinet', config: { width: 1234 } }],
    } })
    await vi.advanceTimersByTimeAsync(400)
    expect(await result).toEqual({ value: true })
  })

  it('reports the browser exception instead of returning undefined to JSON.parse', async () => {
    const { h } = browser()
    await expect(h.evaluate('document.querySelector("#scene-3d canvas").getBoundingClientRect()'))
      .rejects.toThrow(/getBoundingClientRect/)
  })

  it('waits for a restored width even when hydration takes longer than the old 11 s pause', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    setTimeout(() => { state.width = '1234' }, 12_000)
    const restored = h.waitForNumber('Ширина (W)', '1234')
    await vi.advanceTimersByTimeAsync(12_400)
    expect(await restored).toBe(true)
  })

  it('fails when the saved width never reaches the input', async () => {
    vi.useFakeTimers()
    const { h } = browser()
    const restored = h.waitForNumber('Ширина (W)', '1234', 800)
    await vi.advanceTimersByTimeAsync(1200)
    expect(await restored).toBe(false)
  })

  it('waits for the dynamically loaded canvas before reading its centre', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    setTimeout(() => {
      state.canvas = { getBoundingClientRect: () => ({ x: 20, y: 40, width: 600, height: 400 }) }
    }, 12_000)
    const centre = h.sceneCenter().then((value: unknown) => ({ value }), (error: unknown) => ({ error }))
    await vi.advanceTimersByTimeAsync(12_400)
    expect(await centre).toEqual({ value: { x: 320, y: 240 } })
  })

  it('fails clearly when a canvas stays missing instead of producing a JSON error', async () => {
    vi.useFakeTimers()
    const { h } = browser()
    const result = h.sceneCenter(800).then((value: unknown) => ({ value }), (error: unknown) => ({ error }))
    await vi.advanceTimersByTimeAsync(1200)
    expect(await result).toEqual({ error: expect.objectContaining({ message: expect.stringMatching(/canvas/) }) })
  })

  it('does not mistake an absent account modal for a saved project', async () => {
    vi.useFakeTimers()
    const { h } = browser()
    const present = h.waitForCloudProject('Жоба E2E', 800)
    await vi.advanceTimersByTimeAsync(1200)
    expect(await present).toBe(false)
  })

  it('waits for the exact project row, ignoring header text and unrelated rows', async () => {
    vi.useFakeTimers()
    const { state, h } = browser()
    state.body = 'Жоба E2E'
    state.cloudNames = ['Басқа жоба']
    let completed = false
    const present = h.waitForCloudProject('Жоба E2E').then((value: boolean) => {
      completed = true
      return value
    })
    await vi.advanceTimersByTimeAsync(1200)
    expect(completed).toBe(false)
    state.cloudNames.push('Жоба E2E')
    await vi.advanceTimersByTimeAsync(400)
    expect(await present).toBe(true)
  })

  it.each(['clickText', 'clickContains'] as const)('%s does not report disabled save as clicked', async (method) => {
    const { state, h } = browser()
    state.disabled = true
    expect(await h[method]('Сохранить текущий', 0)).toBe(false)
    expect(state.clicked).toBe(false)
    state.disabled = false
    expect(await h[method]('Сохранить текущий', 0)).toBe(true)
    expect(state.clicked).toBe(true)
  })
})
