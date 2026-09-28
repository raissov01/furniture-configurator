import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const exports = readFileSync(new URL('../components/ExportMenu.tsx', import.meta.url), 'utf8')
const languages = readFileSync(new URL('../components/LangSwitch.tsx', import.meta.url), 'utf8')

describe('F00n қосымша құралдар мәзірі', () => {
  it('экспорт пен тіл әрекеттерін ішкі мәзірсіз көрсетеді', () => {
    expect(workspace).toContain('<ExportMenu inline')
    expect(workspace).toContain('<LangSwitch inline />')
    expect(exports).toContain('if (inline) return items')
    expect(languages).toContain('if (inline) return items')
  })
})
