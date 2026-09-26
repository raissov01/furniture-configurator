import type { CutLine } from './cutPlan'

/** Step zero means the saw has not made a cut yet. */
export function playbackStep(current: number, total: number, delta: number): number {
  return Math.max(0, Math.min(total, current + delta))
}

export function playbackFrame(cuts: readonly CutLine[], requestedStep: number): {
  completed: readonly CutLine[]
  active: CutLine | null
  step: number
  total: number
} {
  const step = Math.max(0, Math.min(cuts.length, requestedStep))
  return {
    completed: cuts.slice(0, Math.max(0, step - 1)),
    active: step === 0 ? null : cuts[step - 1]!,
    step,
    total: cuts.length,
  }
}
