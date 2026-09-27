import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

describe('390 × 844 workspace flow', () => {
  it('keeps the scene compact and gives the properties pane its own mobile scroll area', () => {
    expect(source).toMatch(/grid[^"\n]*overflow-y-auto[^"\n]*lg:overflow-hidden/)
    expect(source).toMatch(/<main className="[^"\n]*h-\[32dvh\][^"\n]*max-h-\[32dvh\]/)
    expect(source).toMatch(/<aside className="[^"\n]*h-\[60dvh\][^"\n]*max-h-\[60dvh\]/)
  })

  it('keeps property controls in normal flow above the canvas hit layer', () => {
    expect(source).toMatch(/<aside className="[^"\n]*relative z-10[^"\n]*lg:static/)
    expect(source).toMatch(/min-h-0 flex-1 overflow-y-auto p-3 lg:overflow-auto/)
  })
})
