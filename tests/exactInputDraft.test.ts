import { describe, expect, it } from 'vitest'
import { exactInputDraft } from '../lib/exactInputDraft'

describe('exact input draft', () => {
  it('keeps invalid text out of the model and names the field and allowed range', () => {
    for (const text of ['', '1.5', 'word', '-100']) {
      const result = exactInputDraft(text, 100, 'H', true)
      expect(result.value).toBeUndefined()
      expect(result.error).toContain('H')
      expect(result.error).toContain('> 0')
    }
  })
  it('accepts whole millimetres and negative positions', () => {
    expect(exactInputDraft('+20', 100, 'H', true)).toEqual({ value: 120 })
    expect(exactInputDraft('=-100', 20, 'X', false)).toEqual({ value: -100 })
  })
})
