import { describe, expect, it } from 'vitest'
import { removeSectionContentAt, replaceSectionContent, updateSectionContentAt } from '../lib/f07SectionContents'
import type { SectionContent } from '../src/core/index'

const tower: SectionContent[] = [
  { kind: 'appliance', appliance: 'oven', height: 595, modelId: 'bosch-hbf113br0b' },
  { kind: 'appliance', appliance: 'microwave', height: 380 },
  { kind: 'shelves', count: 2, shelfKind: 'adjustable', at: [1100, 1400] },
]

describe('F07 секция мазмұнын өңдеу', () => {
  it('сөрені өзгерткенде екі құрылғының ретін, артикулын және биіктігін сақтайды', () => {
    expect(replaceSectionContent(tower, 'shelves', { kind: 'shelves', count: 3, shelfKind: 'fixed' }))
      .toEqual([tower[0], tower[1], { kind: 'shelves', count: 3, shelfKind: 'fixed' }])
  })

  it('бірінші құрылғыны ауыстырғанда екіншісін сақтайды', () => {
    expect(replaceSectionContent(tower, 'appliance', { kind: 'appliance', appliance: 'fridge' }))
      .toEqual([{ kind: 'appliance', appliance: 'fridge' }, tower[1], tower[2]])
  })

  it('нақты жолақтың артикулын және биіктігін өзгерткенде қалғанын сақтайды', () => {
    const result = updateSectionContentAt(tower, 1, { kind: 'appliance', appliance: 'microwave', height: 365, modelId: 'bosch-bfl524ms0b' })
    expect(result[0]).toBe(tower[0])
    expect(result[1]).toEqual({ kind: 'appliance', appliance: 'microwave', height: 365, modelId: 'bosch-bfl524ms0b' })
    expect(result[2]).toBe(tower[2])
  })

  it('екінші құрылғыны алып тастағанда біріншісін сақтайды', () => {
    expect(removeSectionContentAt(tower, 1)).toEqual([tower[0], tower[2]])
  })
})
