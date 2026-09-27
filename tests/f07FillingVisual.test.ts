import { describe, expect, it } from 'vitest'
import { fillingGlyph } from '../lib/f07FillingVisual'
import { FILLINGS } from '../src/core/index'

describe('F07 mechanism glyphs', () => {
  it('assigns each sold mechanism a distinct scene glyph', () => {
    const glyphs = FILLINGS.map((model) => fillingGlyph(model.hardwareId))
    expect(new Set(glyphs).size).toBe(FILLINGS.length)
    expect(glyphs).not.toContain('unknown')
  })
})
