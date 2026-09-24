/** CDP boundary fixtures run the real browser expressions, including exceptions. */
import { createContext, runInContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeHelpers } from '../scripts/e2eHelpers.mjs'

function browser() {
  const state = {
    width: '600',
    canvas: null as null | { getBoundingClientRect(): { x: number; y: number; width: number; height: number } },
    cloudNames: [] as string[],
    body: '',
    disabled: false,
    clicked: false,
  }
  const button = {
    textContent: 'Сохранить текущий',
    get disabled() { return state.disabled },
    click() { if (!state.disabled) state.clicked = true },
  }
  const context = createContext({
    document: {
      body: { get innerText() { return state.body } },
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
