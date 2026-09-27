import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

describe('F00e таңдау жолағы', () => {
  it('таңдау ақпаратын сахна ішінде абсолют қабатқа қояды; canvas орны ауыспайды', () => {
    const scene = workspace.indexOf('<main className="relative isolate')
    const overlay = workspace.indexOf('data-testid="selected-info-overlay"')
    const sceneEnd = workspace.indexOf('</main>', scene)
    expect(scene).toBeGreaterThan(0)
    expect(overlay).toBeGreaterThan(scene)
    expect(overlay).toBeLessThan(sceneEnd)
    expect(workspace.slice(overlay, overlay + 350)).toMatch(/absolute/)
    expect(workspace.slice(overlay, overlay + 350)).toMatch(/p100-selection-bar/)
  })
})
