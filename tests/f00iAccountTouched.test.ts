import { describe, expect, it } from 'vitest'
import { visibleAccountErrors } from '@/lib/accountPanelState'

describe('account errors', () => {
  const form = { email: '', password: '', shopName: '' }
  it('stays quiet before editing and shows only touched fields', () => {
    expect(visibleAccountErrors('login', form, false, { email: false, password: false, shopName: false }, false)).toEqual({})
    expect(visibleAccountErrors('login', form, false, { email: true, password: false, shopName: false }, false))
      .toEqual({ email: 'Почта: укажите адрес вида name@example.com' })
  })
  it('shows all errors after submission', () => {
    expect(Object.keys(visibleAccountErrors('register', form, false, { email: false, password: false, shopName: false }, true)))
      .toEqual(['email', 'password'])
  })
})
