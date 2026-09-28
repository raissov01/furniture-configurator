import { describe, expect, it } from 'vitest'
import { visibleAccountErrors } from '../lib/accountPanelState'

describe('аккаунт өрісінің бастапқы күйі', () => {
  const form = { email: '', password: '', shopName: '' }
  it('терезе ашылғанда қызыл қате жоқ', () => {
    expect(visibleAccountErrors('login', form, false, {})).toEqual({})
  })
  it('тек өзгертілген өрістің себебі көрінеді', () => {
    const errors = visibleAccountErrors('login', form, false, { email: true })
    expect(errors.email).toMatch(/Почта/)
    expect(errors.password).toBeUndefined()
  })
})
