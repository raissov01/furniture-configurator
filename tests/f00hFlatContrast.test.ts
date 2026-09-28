import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('F00h жалпақ стиль және контраст', () => {
  it('раскрой беті классикалық палитраны, анық статистика жазуын алады', () => {
    const cut = source('components/CutPage.tsx')
    expect(cut).toContain('p100-cut-page')
    expect(cut).toContain('text-[var(--p100-muted)]')
    expect(source('app/globals.css')).toContain('.p100-cut-page .uppercase { text-transform: none;')
  })

  it('смета қорытындысы аударылады, модал бұлдыр емес және ескерту қою', () => {
    expect(source('components/QuoteView.tsx')).not.toMatch(/ВСЕГО|СКИДКА|К ОПЛАТЕ/)
    expect(source('components/ProjectPanel.tsx')).not.toContain('backdrop-blur')
    expect(source('components/RenderPanel.tsx')).toContain('text-amber-900')
    expect(source('components/Workspace.tsx')).toContain('bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-600')
  })
})
