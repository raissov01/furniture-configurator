import { describe, expect, it } from 'vitest'
import { sanitizeGeneratedOptions } from '../src/core/stageBrief'

describe('сөзбен жиһаз шебері', () => {
  it('кабинет пен жатын бөлмені қолдайды; сыймайтын ұзындықты рұқсат шегіне әкеледі', () => {
    expect(sanitizeGeneratedOptions({ type: 'office', layout: 'corner', lengthA: 700, lengthB: 2200,
      sink: false, upper: false, appliances: false })).toMatchObject({ type: 'office', layout: 'corner', lengthA: 800 })
    expect(sanitizeGeneratedOptions({ type: 'bedroom', layout: 'corner', lengthA: 1000, lengthB: 2000,
      sink: false, upper: false, appliances: false })).toMatchObject({ type: 'bedroom', layout: 'straight', lengthA: 1600, lengthB: null })
  })
})
