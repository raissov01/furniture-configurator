import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assemblyStepView } from '../lib/assemblyStepView'

describe('assembly steps', () => {
  it('keeps the visible step within available physical panels', () => {
    expect(assemblyStepView(1, 11)).toEqual({ max: 11, value: 1, label: '1 / 11' })
    expect(assemblyStepView(12, 11)).toEqual({ max: 11, value: 11, label: '11 / 11' })
    expect(assemblyStepView(1, 0)).toEqual({ max: 1, value: 1, label: '1 / 0' })
  })

  it('exposes the step slider beside the visible classic toolbar', () => {
    const source = readFileSync('components/Workspace.tsx', 'utf8')
    expect(source).toMatch(/p100-toolbar[^]*data-testid="classic-assembly-step"/)
  })
})
