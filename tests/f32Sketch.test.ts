import { describe, expect, it } from 'vitest'
import { eraseDividerDecision, eraseBandDecision, mergeSectionsForErase, mergeBandsForErase,
  splitDecision, sketchContentDecision } from '../lib/f32Sketch'
import type { Section } from '../src/core/types'

describe('F32 UI decisions', () => {
  it('asks before a divider or band erase can discard content', () => {
    const left = { id: 'left', contents: [{ kind: 'shelves' }], fronts: null }
    const right = { id: 'right', contents: [{ kind: 'rod' }], fronts: { count: 1 } }
    expect(eraseDividerDecision(left, right).requiresConfirmation).toBe(true)
    expect(eraseDividerDecision({ ...left, contents: [{ kind: 'empty' }] }, right).keep).toBe('right')
    expect(eraseBandDecision({ kind: 'rod' }, { kind: 'drawers' }).requiresConfirmation).toBe(true)
    expect(eraseBandDecision({ kind: 'empty' }, { kind: 'drawers' }).keep).toBe('upper')
    const sections = [
      { id: 'left', contents: [{ kind: 'empty' }], fronts: null, widthMode: 'fixed', width: 200 },
      { id: 'right', contents: [{ kind: 'rod' }], fronts: { count: 1, mount: 'overlay' }, widthMode: 'fixed', width: 200 },
    ] as Section[]
    expect(mergeSectionsForErase(sections, 0, 'right')[0]?.contents[0]?.kind).toBe('rod')
    expect(mergeSectionsForErase(sections, 0, 'right')[0]?.fronts).toEqual(sections[1]?.fronts)
    const withBands = { ...sections[0]!, contents: [{ kind: 'empty' }, { kind: 'rod' }] } as Section
    expect(mergeBandsForErase(withBands, 0, 'upper').contents[0]?.kind).toBe('rod')
  })
  it('explains split bounds, count limits and replacement before changing a band', () => {
    expect(splitDecision(50, 300, 16, 'divider').error).toContain('100')
    expect(splitDecision(150, 300, 16, 'divider').allowed).toBe(true)
    expect(sketchContentDecision({ kind: 'shelves', count: 20, shelfKind: 'adjustable' }, 'shelf').error).toContain('20')
    expect(sketchContentDecision({ kind: 'drawers', count: 2 }, 'rod').requiresConfirmation).toBe(true)
  })
})
