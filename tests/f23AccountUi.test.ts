import { describe, expect, it } from 'vitest'
import { accountFormErrors, canSubmitAccount } from '../lib/accountPanelState'

describe('F23 account UI decisions', () => {
  const valid = { email: 'shop@example.kz', password: 'password123', shopName: 'Цех' }

  it('blocks empty and malformed credentials with named ranges', () => {
    expect(canSubmitAccount('login', { ...valid, email: '' }, false)).toBe(false)
    expect(accountFormErrors('login', { ...valid, email: 'wrong' }, false).email).toContain('Почта')
    expect(accountFormErrors('register', { ...valid, password: '1234567' }, false).password).toContain('8')
    expect(canSubmitAccount('register', valid, false)).toBe(true)
  })

  it('uses the same 100-character shop limit as registration and permits the documented default', () => {
    expect(accountFormErrors('register', { ...valid, shopName: 'А'.repeat(101) }, false).shopName).toContain('100')
    expect(canSubmitAccount('register', { ...valid, shopName: ' ' }, false)).toBe(true)
  })

})
