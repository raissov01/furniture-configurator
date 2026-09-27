import { describe, expect, it } from 'vitest'
import { shouldCloseAccountOnKey } from '../lib/accountPanelState'

describe('F23 account modal keyboard', () => {
  it('closes only the top idle account dialog on Escape', () => {
    expect(shouldCloseAccountOnKey('Escape', true, false)).toBe(true)
    expect(shouldCloseAccountOnKey('Enter', true, false)).toBe(false)
    expect(shouldCloseAccountOnKey('Escape', false, false)).toBe(false)
    expect(shouldCloseAccountOnKey('Escape', true, true)).toBe(false)
  })
})
