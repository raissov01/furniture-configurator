import { describe, expect, it } from 'vitest'
import { playbackFrame, playbackStep } from '../src/core/cutPlayback'
import type { CutLine } from '../src/core/cutPlan'

const cuts: CutLine[] = [1, 2, 3].map((order) => ({
  order, axis: 'v', at: order, from: 0, to: 10, kind: 'split',
}))

describe('cut playback', () => {
  it('shows completed cuts and highlights only the current cut', () => {
    expect(playbackFrame(cuts, 0)).toEqual({ completed: [], active: null, step: 0, total: 3 })
    expect(playbackFrame(cuts, 2)).toEqual({ completed: cuts.slice(0, 1), active: cuts[1], step: 2, total: 3 })
    expect(playbackFrame(cuts, 3).completed).toEqual(cuts.slice(0, 2))
  })

  it('clamps steps at either end, including an empty sheet', () => {
    expect(playbackStep(3, 3, 1)).toBe(3)
    expect(playbackStep(0, 3, -1)).toBe(0)
    expect(playbackFrame([], 9)).toEqual({ completed: [], active: null, step: 0, total: 0 })
  })
})
