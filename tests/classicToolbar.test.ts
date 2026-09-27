import { describe, expect, it } from 'vitest'
import { uniqueToolbarRows } from '../lib/classicToolbar'
import { readFileSync } from 'node:fs'

describe('classic toolbar', () => {
  it('keeps the first occurrence of a command and preserves row order', () => {
    const rows = uniqueToolbarRows([
      [{ label: 'Рендер' }, { label: 'Размеры на сцене' }],
      [{ label: 'Размеры на сцене' }, { label: 'Сборка' }, { label: 'Рендер' }],
    ])
    expect(rows).toEqual([[{ label: 'Рендер' }, { label: 'Размеры на сцене' }], [{ label: 'Сборка' }]])
  })
  it('does not show a vacant camera pane or aliases that open the same structure window', () => {
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('className="p100-camera-pane')
    expect(source).not.toContain("icon: 'layers', label: tr('Слои')")
    expect(source).not.toContain("icon: 'library', label: tr('Библиотека')")
  })
  it('offers twelve working tools in the PRO100 side rail', () => {
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    const side = source.match(/className="p100-side-tools[^]*?\{classic \? <>([^]*?)<\/> : <>/)?.[1] ?? ''
    expect((side.match(/<ClassicTool /g) ?? []).length).toBe(12)
    expect(side).toContain('action={addBoard}')
    expect(side).toContain('action={addSolid}')
  })
})
