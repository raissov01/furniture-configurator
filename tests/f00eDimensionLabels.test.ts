import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const labels = readFileSync(new URL('../components/DimensionLabels.tsx', import.meta.url), 'utf8')
const tooltip = readFileSync(new URL('../components/PanelMesh.tsx', import.meta.url), 'utf8')

describe('F00e өлшем белгілері', () => {
  it('tooltip үстінде, ал ен мен тереңдік еденнен жоғары', () => {
    expect(labels).toContain('zIndexRange={[100, 100]}')
    expect(tooltip).toContain('zIndexRange={[10, 0]}')
    expect(labels).not.toContain('position={[W / 2, -70, 0]}')
    expect(labels).not.toContain('position={[W + 70, 0, D / 2]}')
  })
})
