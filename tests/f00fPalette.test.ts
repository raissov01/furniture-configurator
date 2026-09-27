import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../lib/p100Contrast'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const panelMesh = readFileSync(new URL('../components/PanelMesh.tsx', import.meta.url), 'utf8')

function token(name: string): string {
  const value = css.match(new RegExp(`--p100-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
  if (!value) throw new Error(`--p100-${name} missing`)
  return value
}

describe('F00f PRO100 palette', () => {
  it('selection title, muted text and cut accent meet AA on its light surface', () => {
    expect(workspace).toContain('data-testid="selected-info-overlay" className="p100-selection-bar')
    expect(css).toMatch(/\.p100-selection-bar\s*\{[^}]*background:\s*var\(--p100-dialog-content\)/)
    for (const foreground of ['text', 'muted', 'cut-accent']) {
      expect(contrastRatio(token(foreground), token('dialog-content'))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('scene tooltip uses a pale yellow surface, black border and AA text', () => {
    expect(panelMesh).toContain('className="p100-panel-tooltip')
    expect(css).toMatch(/\.p100-panel-tooltip\s*\{[^}]*background:\s*var\(--p100-tooltip\)/)
    expect(contrastRatio(token('tooltip-text'), token('tooltip'))).toBeGreaterThanOrEqual(4.5)
    expect(token('tooltip-border')).toBe(token('text'))
  })
})
