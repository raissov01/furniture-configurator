import { describe, expect, it } from 'vitest'
import { parseKitchenWalls } from '../lib/kitchenWallInput'

describe('F01 kitchen wall inputs', () => {
  it('rejects empty, text, decimal, negative, short and excessively long active walls', () => {
    for (const raw of ['', 'abc', '1234.5', '-100', '0', '599', '9999999']) {
      expect(parseKitchenWalls(raw, '2400', true).errorA).toContain('Стена A')
      expect(parseKitchenWalls('3000', raw, true).errorB).toContain('Стена B')
    }
    expect(parseKitchenWalls('3000', '', false)).toMatchObject({ lengthA: 3000, valid: true })
    expect(parseKitchenWalls('3000', '2400', true)).toMatchObject({ lengthA: 3000, lengthB: 2400, valid: true })
  })
})
