import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../lib/p100Contrast'

const host = readFileSync(new URL('../components/dock/DockHost.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../components/dock/DockPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const token = (name: string) => css.match(new RegExp(`--p100-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? ''

describe('F00f light classic dock in either theme', () => {
  it('uses token based grey tabs, white menu and light panel shells', () => {
    for (const name of ['p100-dock-host', 'p100-dock-closed-tab', 'p100-dock-menu', 'p100-dock-zone', 'p100-dock-panel']) {
      expect(host + panel).toContain(name)
      expect(css).toContain(`.${name}`)
    }
    expect(css).toMatch(/\.p100-dock-closed-tab\s*\{[^}]*background:\s*var\(--p100-tab-strip\)/)
    expect(css).toMatch(/\.p100-dock-menu\s*\{[^}]*background:\s*var\(--p100-field\)/)
    expect(css).toMatch(/\.p100-dock-panel\s*\{[^}]*background:\s*var\(--p100-dialog-content\)/)
    expect(contrastRatio(token('muted'), token('tab-strip'))).toBeGreaterThanOrEqual(4.5)
    expect(host + panel).not.toMatch(/(?:bg|text|border)-neutral-(?:8|9)\d\d/)
    expect(host + panel).not.toMatch(/dark:(?:bg|text|border)-neutral/)
  })
})
