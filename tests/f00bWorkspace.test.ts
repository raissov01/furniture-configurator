import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compactToolbarRows } from '../lib/classicToolbar'

const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

describe('F00b жұмыс кеңістігінің жоғарғы бөлігі', () => {
  it('қайталанған құралдарды алып, төртінші қатарды үшіншіге қосады', () => {
    const rows = compactToolbarRows([
      [{ label: 'А' }], [{ label: 'Б' }], [{ label: 'В' }, { label: 'А' }], [{ label: 'Г' }, { label: 'Б' }],
    ])
    expect(rows).toEqual([[{ label: 'А' }], [{ label: 'Б' }], [{ label: 'В' }, { label: 'Г' }]])
    expect(workspace).toContain('compactToolbarRows<ClassicToolSpec>')
    expect(workspace).not.toContain('index === 3 && <label className="p100-toolbar-style"')
    expect(css).not.toMatch(/\.p100-toolbar\s*\{[^}]*height:\s*196px/)
    expect(css).not.toMatch(/\.p100-toolbar-row:last-child\s*\{[^}]*height:\s*70px/)
  })

  it('Наш режимінде Вид бөлек қатарда тұрмайды', () => {
    expect(workspace).toContain('data-testid="workspace-view-menu"')
    expect(workspace).not.toContain('Екінші қатар: сирек баптаулар')
  })
})
