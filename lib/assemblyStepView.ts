/** A range control always needs a positive upper bound, even for an empty scene. */
export function assemblyStepView(step: number, panelCount: number) {
  const max = Math.max(1, panelCount)
  const value = Math.max(1, Math.min(step, max))
  return { max, value, label: `${value} / ${panelCount}` }
}
