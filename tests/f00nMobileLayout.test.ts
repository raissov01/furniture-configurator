import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const dock = readFileSync(new URL('../components/panels/TreeDock.tsx', import.meta.url), 'utf8')

describe('F00n телефондағы сахна орны', () => {
  it('құралдарды бір қатарда сақтап, қалғанын мәзірге жинайды', () => {
    expect(workspace).toContain('data-testid="mobile-tool-row"')
    expect(workspace).toContain('data-testid="mobile-more-tools"')
    expect(workspace).toContain('flex-nowrap items-center')
  })

  it('сахнаға экранның кемінде жартысын береді және ағашты бастапқыда жабады', () => {
    expect(workspace).toContain('h-[50dvh] min-h-[370px]')
    expect(dock).toContain('useState(true)')
  })
})
