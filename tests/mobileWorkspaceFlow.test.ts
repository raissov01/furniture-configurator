import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

describe('390 × 844 workspace flow', () => {
  it('gives the scene a bounded mobile height and a scrollable grid', () => {
    expect(source).toMatch(/grid[^"\n]*overflow-y-auto[^"\n]*lg:overflow-hidden/)
    expect(source).toMatch(/<main className="[^"\n]*h-\[55dvh\][^"\n]*max-h-\[55dvh\]/)
  })

  it('keeps property controls in normal flow above the canvas hit layer', () => {
    expect(source).toMatch(/<aside className="[^"\n]*relative z-10[^"\n]*lg:static/)
    expect(source).toMatch(/min-h-0 flex-1 overflow-visible p-3 lg:overflow-auto/)
  })
})
