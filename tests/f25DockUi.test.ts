import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextDockRequest } from '@/lib/treeDockUi'

describe('F25 толық каталог dock', () => {
  it('кітапхана батырмасы қайта басылғанда да жаңа ашу сұрауын береді', () => {
    const first = nextDockRequest({ tab: 'structure', revision: 0 }, 'library')
    const second = nextDockRequest(first, 'library')
    expect(first).toEqual({ tab: 'library', revision: 1 })
    expect(second.revision).toBe(2)
  })
  it('негізгі dock толық LibraryPanel қолданады және мобильді панель сахнадан бөлек', () => {
    const tree = readFileSync(new URL('../components/panels/TreeDock.tsx', import.meta.url), 'utf8')
    const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(tree).toContain('<LibraryPanel />')
    expect(workspace).toContain('data-testid="mobile-tree-dock"')
    expect(workspace.indexOf('data-testid="mobile-tree-dock"')).toBeLessThan(workspace.indexOf('data-tour="scene"'))
    expect(workspace).toContain("action: () => openDockTab('library')")
    // f425ad7: «Библиотека» жоғарғы «Проект» мәзіріне көшті; әрекеті сол openDockTab('library').
    expect(workspace).toContain("<MenuItem onClick={() => openDockTab('library')}>{tr('Библиотека')}</MenuItem>")
  })
})
