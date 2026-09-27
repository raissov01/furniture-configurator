import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const file = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('classic floating windows', () => {
  it('lets the structure tree resize and names the active tab', () => {
    const css = file('app/globals.css')
    const structure = file('components/ClassicStructureWindow.tsx')
    expect(css).toMatch(/\.p100-floating-window \{[^}]*resize: both;/)
    expect(css).toMatch(/\.p100-floating-window \.p100-tree-dock \{[^}]*height: calc\(100% - 26px\)/)
    expect(structure).toContain('treeDockTabLabels[tab]')
    expect(structure).toContain('onTabChange={setTab}')
  })

  it('keeps large dialogs within 80 percent of the viewport height', () => {
    const css = file('app/globals.css')
    expect(css).toMatch(/\.p100-dialog \{[^}]*height: min\(600px, 80dvh\)/)
    expect(file('components/QuoteView.tsx')).toContain('max-h-[80dvh] overflow-y-auto')
    expect(file('components/RoomPlan.tsx')).toContain('max-h-[80dvh] overflow-y-auto')
  })
})
