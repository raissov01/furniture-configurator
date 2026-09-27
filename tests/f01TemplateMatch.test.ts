import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogOf, SEED_TEMPLATES, templateToCabinet } from '../src/core/index'
import { defaultShop } from '../lib/defaults'
import { matchTemplateId } from '../lib/templateMatch'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => { useConfigurator.setState(baseline, true); vi.unstubAllGlobals() })

describe('F01 gallery selection', () => {
  it('marks only an exact single-cabinet match', () => {
    const catalog = catalogOf(defaultShop)
    const template = SEED_TEMPLATES.find((item) => item.id === 'kitchen-base-600')!
    const cabinet = { ...templateToCabinet(template, catalog), id: 'cabinet-1' }
    expect(matchTemplateId([cabinet], cabinet.id, catalog)).toBe(template.id)
    expect(matchTemplateId([{ ...cabinet, width: 601 }], cabinet.id, catalog)).toBe('')
    expect(matchTemplateId([cabinet, { ...cabinet, id: 'other' }], cabinet.id, catalog)).toBe('')
  })

  it('derives the selected card from the saved configuration after hydration', () => {
    const files = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => files.get(key) ?? null,
      setItem: (key: string, value: string) => { files.set(key, value) },
    } })
    useConfigurator.getState().reset()
    useConfigurator.getState().loadTemplate('kitchen-base-600')
    useConfigurator.getState().saveProjectLocally()
    useConfigurator.getState().reset()
    useConfigurator.getState().hydrateProject()
    const state = useConfigurator.getState()
    expect(matchTemplateId(state.cabinets, state.activeId, state.catalog)).toBe('kitchen-base-600')
  })
})
