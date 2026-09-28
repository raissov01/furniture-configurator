import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hexContrast } from '../lib/brandPalette'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('../components/site/SheetFigure.tsx', import.meta.url), 'utf8')

describe('F00b бренд палитрасы', () => {
  it('графит пен амбердің контрасты AA деңгейінде', () => {
    expect(css).toContain('--brand-graphite: #1f2a37')
    expect(css).toContain('--brand-amber: #f2a33a')
    expect(hexContrast('#1f2a37', '#f2a33a')).toBeGreaterThanOrEqual(4.5)
    expect(hexContrast('#ffffff', '#1f2a37')).toBeGreaterThanOrEqual(4.5)
    expect(hexContrast('#f2a33a', '#273342')).toBeGreaterThanOrEqual(4.5)
  })

  it('лендинг пен раскрой иллюстрациясы сол токендерді қолданады', () => {
    expect(css).toContain('--oak: var(--brand-amber)')
    expect(css).toContain('--blueprint: var(--brand-graphite)')
    expect(sheet).toContain('fill="var(--brand-amber)"')
    expect(sheet).not.toContain('fill="var(--blueprint)"')
  })

  // F00c десктоптағы «Наш» режимін алып тастады: оның графит/амбер ережелері де жоқ.
  it('Наш режимі жоқ, оның бөлек стилі де қалмады', () => {
    expect(workspace).not.toContain('"ours-workspace"')
    expect(css).not.toContain('.ours-workspace')
  })
})
