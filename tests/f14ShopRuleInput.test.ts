import { describe, expect, it } from 'vitest'
import { parseNumberDraft } from '../lib/numberDraft'
import { ruleInputPolicy } from '../lib/shopRuleInput'

describe('F14 minBandSubtract input', () => {
  it('requires a whole millimetre of at least one and names the rejected setting', () => {
    const policy = ruleInputPolicy('minBandSubtract')
    expect(policy).toMatchObject({ min: 1, label: 'minBandSubtract' })
    for (const raw of ['', '0', '-1', '0.4', 'abc']) {
      expect(parseNumberDraft(raw, { min: policy.min, integer: true })).toHaveProperty('error')
    }
    expect(parseNumberDraft('1', { min: policy.min, integer: true })).toEqual({ value: 1 })
  })

  it('keeps zero valid for rules where zero has an explicit meaning', () => {
    const policy = ruleInputPolicy('confirmatSpanForThird')
    expect(parseNumberDraft('0', { min: policy.min, integer: true })).toEqual({ value: 0 })
  })
})
