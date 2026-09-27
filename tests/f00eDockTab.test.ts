import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dock = readFileSync(new URL('../components/dock/DockHost.tsx', import.meta.url), 'utf8')

describe('F00e Панели қойындысы', () => {
  it('ақcұр, 1px жиекті', () => {
    expect(dock).toMatch(/workspace-dock-host[^\n]*p100-dock-host/)
    expect(dock).toMatch(/aria-label=\{tr\('Панели'\)\}[^\n]*p100-dock-closed-tab/)
  })
})
