import { describe, expect, it } from 'vitest'
import { panelOpacity } from '../lib/panelOpacity'

describe('F00o рентген мөлдірлігі', () => {
  it('рентген фасадты hover және selection кезінде де ghost күйінде ұстайды', () => {
    expect(panelOpacity({ xray: true, viewMode: 'ghost', hovered: true, selected: false, lookOpacity: 1 })).toBe(0.28)
    expect(panelOpacity({ xray: true, viewMode: 'ghost', hovered: false, selected: true, lookOpacity: 1 })).toBe(0.28)
  })

})
