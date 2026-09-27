import { describe, expect, it } from 'vitest'
import { planSectionAddition } from '../lib/sectionUi'
import { defaultCabinet, defaultShop } from '../lib/defaults'
import { catalogOf } from '../src/core/index'
import { catalog, referenceWardrobe } from './fixtures'

describe('F03 section controls', () => {
  it('assigns a free id after a middle section is removed', () => {
    const cabinet = { ...referenceWardrobe, width: 1800, sections: [
      referenceWardrobe.sections[0]!,
      { ...referenceWardrobe.sections[0]!, id: 's3' },
    ] }
    const result = planSectionAddition(cabinet, catalog)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.sections.map((section) => section.id)).toEqual(['s1', 's3', 's2'])
  })

  it('rejects the third section before replacing the valid cabinet', () => {
    const liveCatalog = catalogOf(defaultShop)
    const first = planSectionAddition(defaultCabinet, liveCatalog, defaultShop.settings)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = planSectionAddition({ ...defaultCabinet, sections: first.sections }, liveCatalog, defaultShop.settings)
    expect(second).toMatchObject({ ok: false })
    if (!second.ok) expect(second.message).toMatch(/handle\.boreSpacing.*рұқсат етілген/)
  })

})
