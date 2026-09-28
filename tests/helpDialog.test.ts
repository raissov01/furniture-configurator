import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { helpDialogKeyAction } from '../lib/helpDialog'

describe('help dialog keyboard', () => {
  it('closes on Escape only while open', () => {
    expect(helpDialogKeyAction('Escape', true)).toBe('close')
    expect(helpDialogKeyAction('Escape', false)).toBeNull()
    expect(helpDialogKeyAction('Enter', true)).toBeNull()
  })

  it('wires dialog semantics, Escape and focus restoration', () => {
    const source = readFileSync(new URL('../components/HelpPanel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('aria-modal="true"')
    expect(source).toContain('aria-labelledby="help-dialog-title"')
    expect(source).toContain("useModalLayer(open, 'help', () => setOpen(false))")
    expect(source).toContain('returnFocus?.focus()')
  })
})
