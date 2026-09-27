import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator, activeCabinet } from '../store/configurator'
import { defaultCabinet } from '../lib/defaults'

const baseline = useConfigurator.getState()

afterEach(() => useConfigurator.setState({
  root: baseline.root, cabinets: baseline.cabinets, placements: baseline.placements,
  activeId: baseline.activeId, catalog: baseline.catalog, shop: baseline.shop,
  projectSettings: baseline.projectSettings, past: [], future: [], lastEditKey: null,
}))

describe('F03 section add store action', () => {
  it('keeps the valid model and undo history when the next section cannot fit', () => {
    expect(activeCabinet(useConfigurator.getState()).sections).toHaveLength(defaultCabinet.sections.length)
    expect(useConfigurator.getState().addSection()).toBeNull()
    const before = useConfigurator.getState()
    const error = before.addSection()
    expect(error).toMatch(/handle\.boreSpacing/)
    expect(activeCabinet(useConfigurator.getState()).sections).toEqual(activeCabinet(before).sections)
    expect(useConfigurator.getState().past).toEqual(before.past)
  })
})
