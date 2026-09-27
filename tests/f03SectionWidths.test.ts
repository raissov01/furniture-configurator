import { describe, expect, it } from 'vitest'
import { sectionWidths } from '../lib/sectionWidths'
import { catalog, referenceWardrobe } from './fixtures'

describe('F03 calculated section widths', () => {
  it('shows flex widths with the extra millimetre on the left', () => {
    const cabinet = { ...referenceWardrobe, width: 1800, sections: [
      { ...referenceWardrobe.sections[0]!, widthMode: 'fixed' as const, width: 401 },
      { ...referenceWardrobe.sections[0]!, id: 's2' },
      { ...referenceWardrobe.sections[0]!, id: 's3' },
    ] }
    expect(sectionWidths(cabinet, catalog)).toEqual([401, 668, 667])
  })
})
