import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

describe('390 × 844 workspace flow', () => {
  it('gives the scene at least 40% of phone height and keeps properties below it', () => {
    expect(source).toMatch(/grid[^"\n]*overflow-y-auto[^"\n]*lg:overflow-hidden/)
    expect(source).toMatch(/<main className="[^"\n]*isolate[^"\n]*h-\[40dvh\][^"\n]*min-h-\[337px\][^"\n]*overflow-hidden/)
    expect(source).toMatch(/<aside className="[^"\n]*h-\[45dvh\][^"\n]*max-h-\[45dvh\][^"\n]*lg:hidden/)
    expect(source).toContain('data-testid="mobile-tree-dock"')
    expect(source).toContain('className="compact-tools')
    expect(source).not.toContain('max-h-[35dvh] overflow-y-auto')
  })

  it('puts a touch button above the canvas and opens the full-screen mobile properties panel', () => {
    expect(source).toMatch(/data-testid="mobile-properties-trigger"/)
    expect(source).toMatch(/z-30[^"\n]*lg:hidden/)
    expect(source).toMatch(/setPropertiesNodeId\(activeId\)/)
    expect(source).toMatch(/min-h-0 flex-1 overflow-y-auto p-3 lg:hidden/)
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\.p100-dialog \{[^}]*width: 100vw;[^}]*height: 100dvh;/)
    expect(css).toMatch(/\.p100-floating-window \{ display: none;/)
    expect(css).toMatch(/@media \(min-width: 1024px\) \{ \.p100-floating-window \{ display: block;/)
  })

  it('hides the classic menu on phone and keeps controls at least 44 px with 14 px text', () => {
    expect(source).toMatch(/data-testid="classic-menubar"[^\n]*hidden lg:flex/)
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\[data-workspace-style\][^{}]*\{[^}]*min-height:\s*44px;[^}]*font-size:\s*14px;/)
  })
})
