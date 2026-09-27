import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

describe('390 × 844 workspace flow', () => {
  it('keeps the scene compact and gives the properties pane its own mobile scroll area', () => {
    expect(source).toMatch(/grid[^"\n]*overflow-y-auto[^"\n]*lg:overflow-hidden/)
    expect(source).toMatch(/<main className="[^"\n]*isolate[^"\n]*h-\[28dvh\][^"\n]*max-h-\[28dvh\][^"\n]*overflow-hidden/)
    expect(source).toMatch(/<aside className="[^"\n]*min-h-\[360px\][^"\n]*lg:max-h-none/)
  })

  it('puts a touch button above the canvas and opens the full-screen mobile properties panel', () => {
    expect(source).toMatch(/data-testid="mobile-properties-trigger"/)
    expect(source).toMatch(/z-30[^"\n]*lg:hidden/)
    expect(source).toMatch(/setPropertiesNodeId\(activeId\)/)
    expect(source).toMatch(/min-h-0 flex-1 overflow-y-auto p-3 lg:overflow-auto/)
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\.p100-dialog \{[^}]*width: 100vw;[^}]*height: 100dvh;/)
  })

  it('hides the classic menu on phone and keeps controls at least 44 px with 14 px text', () => {
    expect(source).toMatch(/data-testid="classic-menubar"[^\n]*hidden lg:flex/)
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\[data-workspace-style\][^{}]*\{[^}]*min-height:\s*44px;[^}]*font-size:\s*14px;/)
  })
})
