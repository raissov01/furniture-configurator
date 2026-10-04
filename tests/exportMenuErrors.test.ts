import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  run: vi.fn(), state: [] as unknown[], cursor: 0,
}))
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useState: (initial: unknown) => {
    const index = mocks.cursor++
    if (!(index in mocks.state)) mocks.state[index] = initial
    return [mocks.state[index], (value: unknown) => { mocks.state[index] = value }]
  } }
})
vi.mock('../lib/shopExport', () => ({ runShopExport: mocks.run }))
vi.mock('../lib/panorama', () => ({ downloadPanorama: vi.fn() }))
vi.mock('../store/configurator', () => ({ useConfigurator: (selector: (s: unknown) => unknown) => selector({ catalog: {}, projectInfo: {}, shop: { settings: {} } }) }))
vi.mock('../lib/i18n', () => ({ t: (text: string) => text }))
vi.mock('../components/ui', () => ({ Menu: 'menu', MenuItem: 'button' }))
import { ExportMenu } from '../components/ExportMenu'

type Element = ReactElement<{ children?: ReactNode; onClick?: () => void; role?: string }>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [element, ...elements(element.props.children)]
}
function render(inline = false, onError = vi.fn()) {
  mocks.cursor = 0
  return ExportMenu({ panels: [], inline, onError })
}
async function clickExport(tree: ReactNode) {
  const button = elements(tree).find(element => element.props.onClick)
  expect(button).toBeDefined()
  button!.props.onClick!()
  await vi.waitFor(() => expect(mocks.state[0]).toBeNull())
}

beforeEach(() => { mocks.run.mockReset(); mocks.state = []; mocks.cursor = 0 })
describe('ExportMenu failure recovery', () => {
  it.each([false, true])('shows rejection, notifies its host and clears stale error after retry (inline=%s)', async inline => {
    const onError = vi.fn()
    mocks.run.mockRejectedValueOnce(new Error('Geometry must be verified'))
    await clickExport(render(inline, onError))
    expect(onError).toHaveBeenCalledWith('Geometry must be verified')
    const alert = elements(render(inline, onError)).find(element => element.props.role === 'alert')
    expect(alert?.props.children).toBe('Geometry must be verified')
    mocks.run.mockResolvedValueOnce(undefined)
    await clickExport(render(inline, onError))
    expect(elements(render(inline, onError)).some(element => element.props.role === 'alert')).toBe(false)
    expect(mocks.run).toHaveBeenCalledTimes(2)
  })
  it('clears the persistent host banner after the inline menu unmounts and a retry succeeds', async () => {
    let hostError: string | null = null
    const report = vi.fn((message: string | null) => { hostError = message })
    mocks.run.mockRejectedValueOnce(new Error('Old failure'))
    await clickExport(render(true, report))
    expect(hostError).toBe('Old failure')
    // Workspace remains mounted; MenuItem closes and destroys its child menu.
    mocks.state = []
    mocks.run.mockResolvedValueOnce(undefined)
    await clickExport(render(true, report))
    expect(hostError).toBeNull()
  })
  it('turns a non-Error rejection into actionable fallback text', async () => {
    const onError = vi.fn()
    mocks.run.mockRejectedValueOnce(null)
    await clickExport(render(false, onError))
    expect(onError).toHaveBeenCalledWith('Не удалось экспортировать файл. Повторите попытку.')
  })
})
