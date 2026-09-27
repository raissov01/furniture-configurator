import { describe, expect, it } from 'vitest'
import { fixtureChoiceDisabled } from '../lib/f07FixtureChoice'

describe('F07 fixture choices', () => {
  it('prevents choosing a hob in a module with a sink', () => {
    expect(fixtureChoiceDisabled([{ kind: 'sink' }], 'hob')).toBe(true)
    expect(fixtureChoiceDisabled([{ kind: 'sink' }], 'sink')).toBe(false)
  })
  it('prevents choosing a sink in a module with a hob', () => {
    expect(fixtureChoiceDisabled([{ kind: 'hob', fuel: 'gas' }], 'sink')).toBe(true)
    expect(fixtureChoiceDisabled([{ kind: 'hood' }], 'sink')).toBe(false)
  })
})
