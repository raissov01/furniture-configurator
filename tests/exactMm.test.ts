import { describe, expect, it } from 'vitest'
import { parseExactMm } from '../src/core/exactMm'

describe('дәл мм енгізу', () => {
  it('абсолют және салыстырмалы +/- өрнектерін ажыратады', () => {
    expect(parseExactMm('625', 600)).toBe(625)
    expect(parseExactMm('+25', 600)).toBe(625)
    expect(parseExactMm('-10', 600)).toBe(590)
    expect(parseExactMm(' -200 ', 100)).toBe(-100)
    expect(parseExactMm('=-200', 100)).toBe(-200)
  })
  it('бөлшек пен шектен асқан мәнді өріс атымен қабылдамайды', () => {
    expect(() => parseExactMm('1.5', 0)).toThrow(/value/)
    expect(() => parseExactMm('+5', Number.MAX_SAFE_INTEGER)).toThrow(/value/)
    expect(() => parseExactMm('', 0)).toThrow(/value/)
  })
})
