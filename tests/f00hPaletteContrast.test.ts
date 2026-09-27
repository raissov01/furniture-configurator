import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hexContrast } from '../lib/brandPalette'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = source('app/globals.css')
const token = (name: string) => {
  const value = css.match(new RegExp(`--p100-${name}: (#[0-9a-f]{6})`, 'i'))?.[1]
  if (!value) throw new Error(`--p100-${name} missing`)
  return value
}

describe('F00h классикалық палитра және контраст', () => {
  it('док, таңдау, мәзір және өріс мәтіні AA контрастын сақтайды', () => {
    for (const background of ['chrome', 'dialog', 'dialog-content', 'field', 'tool-selected']) {
      expect(hexContrast(token('text'), token(background)), background).toBeGreaterThanOrEqual(4.5)
      expect(hexContrast(token('muted'), token(background)), background).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('классикалық жұмыс орны dark нұсқасын қоспайды және жалпақ мәзір қолданады', () => {
    expect(css).toContain(':not(.p100-workspace, .p100-workspace *, .p100-cut-page, .p100-cut-page *)')
    expect(css).toContain('.p100-workspace [role="menuitem"]')
    expect(css).toContain('.p100-workspace .uppercase { text-transform: none;')
    expect(css).toContain('.p100-workspace .fixed.inset-0 > .bg-white')
    expect(css).toContain('border-width: 1px')
  })

  it('қара док мазмұны қалмайды', () => {
    for (const path of ['FindPanel', 'ReplacePanel', 'LibraryPanel', 'PersonalLibraryPanel', 'ImportPanel']) {
      const panel = source(`components/panels/${path}.tsx`)
      expect(panel, path).not.toMatch(/bg-neutral-9(?:00|50)/)
    }
  })

  it('док қатесі мен ескертуі ашық фонда оқылады', () => {
    expect(hexContrast(token('warning'), token('dialog-content'))).toBeGreaterThanOrEqual(4.5)
    expect(hexContrast(token('success'), token('dialog-content'))).toBeGreaterThanOrEqual(4.5)
    expect(hexContrast(token('invalid'), token('dialog-content'))).toBeGreaterThanOrEqual(4.5)
    for (const path of ['FindPanel', 'ReplacePanel', 'LibraryPanel', 'PersonalLibraryPanel', 'ImportPanel']) {
      const panel = source(`components/panels/${path}.tsx`)
      expect(panel, path).not.toMatch(/(?:bg|text)-(?:red|amber|emerald)-(?:300|400|500|950)/)
    }
  })
})
