import { describe, expect, it } from 'vitest'
import { memberRemovalWarning } from '../lib/accountPanelState'

describe('F23 member removal confirmation', () => {
  it('states the account and future login are deleted for self and other members', () => {
    for (const self of [true, false]) {
      expect(memberRemovalWarning(self)).toMatch(/аккаунт/i)
      expect(memberRemovalWarning(self)).toMatch(/войти/i)
    }
  })
})
