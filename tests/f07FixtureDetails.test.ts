import { describe, expect, it } from 'vitest'
import { updateFixtureAt } from '../lib/f07FixtureDetails'
import type { CabinetFixture } from '../src/core/index'

const fixtures: CabinetFixture[] = [{ kind: 'sink' }, { kind: 'hood' }]

describe('F07 fixture details', () => {
  it('sets the article and front inset without losing another fixture', () => {
    const result = updateFixtureAt(fixtures, 0, { kind: 'sink', modelId: 'blanco-522201', frontInset: 60 })
    expect(result[0]).toEqual({ kind: 'sink', modelId: 'blanco-522201', frontInset: 60 })
    expect(result[1]).toBe(fixtures[1])
  })
})
